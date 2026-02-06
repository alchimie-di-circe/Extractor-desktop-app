"""
FastAPI sidecar server for Cagent engine.

This server handles:
- Agent execution requests via Cagent subprocess
- Real-time event streaming via SSE
- Health checks for lifecycle management
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import sys
import asyncio
import uuid
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from sse_starlette.sse import EventSourceResponse

from config import Settings
from runtime import CagentRuntime, CagentRuntimeError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)
settings = Settings()


# Localhost-only security helper
def _check_localhost(request: Request) -> None:
    """Verify that request originates from localhost.
    
    Args:
        request: FastAPI Request object
        
    Raises:
        HTTPException: If request is not from localhost
    """
    if request.client.host not in ["127.0.0.1", "localhost", "::1"]:
        raise HTTPException(
            status_code=403,
            detail="Operation only allowed from localhost"
        )


# Pydantic models
class AgentRequest(BaseModel):
    """Request to execute an agent"""
    agent_id: str
    input: dict
    context: Optional[dict] = None


class AgentStartResponse(BaseModel):
    """Response from agent execution start"""
    request_id: str
    status: str
    message: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str


class StreamEvent(BaseModel):
    """Event streamed via SSE"""
    event_type: str  # 'thinking', 'tool_call', 'result', 'error', 'keepalive'
    data: dict
    timestamp: float


# Global state
event_queues: dict[str, asyncio.Queue] = {}
cagent_runtime: Optional[CagentRuntime] = None


# Lifecycle handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    global cagent_runtime
    logger.info("Cagent Sidecar starting up")

    # Initialize runtime
    try:
        cagent_runtime = CagentRuntime(team_yaml_path="team.yaml")
        logger.info("CagentRuntime initialized successfully")
    except CagentRuntimeError as e:
        logger.error(f"Failed to initialize CagentRuntime: {e}")
        raise

    yield

    logger.info("Cagent Sidecar shutting down")
    if cagent_runtime:
        await cagent_runtime.shutdown()

    # Clear event queues
    event_queues.clear()


# Create FastAPI app
app = FastAPI(
    title="Cagent Sidecar",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware for Electron compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["file://", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for liveness probes"""
    cagent_available = cagent_runtime is not None
    status = "ok" if cagent_available else "degraded"
    return HealthResponse(status=status, version="1.0.0")


# Background task for agent execution
async def _execute_agent_background(request_id: str, request: AgentRequest) -> None:
    """
    Execute agent in background and push events to SSE queue.

    Args:
        request_id: Unique request identifier
        request: Agent execution request
    """
    event_queue = asyncio.Queue()
    event_queues[request_id] = event_queue

    try:
        logger.debug(f"[{request_id}] Starting background execution of {request.agent_id}")

        # Extract input from dict
        user_input = request.input.get("input", str(request.input))

        async for event in cagent_runtime.execute_agent(
            agent_id=request.agent_id,
            user_input=user_input,
            context=request.context,
        ):
            await event_queue.put(event)

            if event.event_type in ("result", "error"):
                break

        logger.debug(f"[{request_id}] Background execution completed")

    except Exception as e:
        logger.exception(f"[{request_id}] Background execution failed")
        # Push generic error event to client (full error logged above)
        from event_parser import CagentEvent, EventType
        error_event = CagentEvent(
            event_type=EventType.ERROR,
            data={
                "error": "Agent execution failed",
                "error_code": "EXEC_ERROR"
            },
            timestamp=time.time(),
        )
        await event_queue.put(error_event)
    finally:
        # Signal end of stream
        await event_queue.put(None)


# Agent execution endpoint
@app.post("/agent/execute", response_model=AgentStartResponse)
async def execute_agent(agent_request: AgentRequest, request: Request):
    """
    Execute an agent with the given input.

    Returns immediately with a request_id.
    Client should connect to /agent/stream/{request_id} to receive events.
    """
    _check_localhost(request)
    
    if not cagent_runtime:
        raise HTTPException(status_code=503, detail="Cagent runtime not initialized")

    request_id = str(uuid.uuid4())
    logger.info(f"[{request_id}] Execution request: {agent_request.agent_id}")

    # Start background task
    asyncio.create_task(_execute_agent_background(request_id, agent_request))

    return AgentStartResponse(
        request_id=request_id,
        status="started",
        message=f"Connect to /agent/stream/{request_id} to receive events",
    )


# SSE streaming endpoint
async def agent_event_generator(request_id: str) -> AsyncGenerator:
    """Generate events from the agent event queue for SSE streaming"""
    import json

    # Get or create queue
    if request_id not in event_queues:
        event_queues[request_id] = asyncio.Queue()

    queue = event_queues[request_id]

    try:
        while True:
            try:
                # Wait for event with timeout (30s keepalive)
                event = await asyncio.wait_for(queue.get(), timeout=30.0)

                # Check for end-of-stream marker
                if event is None:
                    logger.debug(f"[{request_id}] Stream ended (None marker)")
                    break

                logger.debug(f"[{request_id}] Streaming event: {event.event_type}")
                yield {
                    "event": event.event_type,
                    "data": json.dumps(event.to_dict()),
                }

                # Stop streaming on terminal events
                if event.event_type in ("result", "error"):
                    break

            except asyncio.TimeoutError:
                # Send keepalive event to prevent connection timeout
                logger.debug(f"[{request_id}] SSE keepalive")
                yield {
                    "event": "keepalive",
                    "data": '{"message": "keepalive"}',
                }
    except asyncio.CancelledError:
        logger.info(f"[{request_id}] SSE stream cancelled")
    finally:
        # Cleanup queue
        if request_id in event_queues:
            del event_queues[request_id]
        logger.debug(f"[{request_id}] SSE stream cleanup complete")


@app.get("/agent/stream/{request_id}")
async def stream_events(request_id: str, request: Request):
    """
    Stream real-time events from agent execution via Server-Sent Events.
    
    Usage:
    - Client connects to /agent/stream/{request_id}
    - Server sends events as they occur
    - Stream ends when terminal event (result/error) is sent
    """
    _check_localhost(request)
    
    logger.info(f"SSE stream started for request {request_id}")
    return EventSourceResponse(
        agent_event_generator(request_id),
        media_type="text/event-stream",
    )


# Shutdown endpoint
@app.post("/shutdown")
async def shutdown(request: Request):
    """Endpoint for graceful shutdown notification - localhost only"""
    _check_localhost(request)
    
    logger.info("Shutdown requested, preparing cleanup")

    global cagent_runtime

    if cagent_runtime:
        await cagent_runtime.shutdown()

    # Clean up any remaining event queues
    event_queues.clear()

    return {"status": "shutting down"}


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower(),
    )
