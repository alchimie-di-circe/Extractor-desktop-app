"""
FastAPI sidecar server for Cagent engine.

This server handles:
- Agent execution requests
- Real-time event streaming via SSE
- Health checks for lifecycle management
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import sys
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from sse_starlette.sse import EventSourceResponse

from config import Settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)
settings = Settings()


# Pydantic models
class AgentRequest(BaseModel):
    """Request to execute an agent"""
    agent_id: str
    input: dict
    context: Optional[dict] = None


class AgentResponse(BaseModel):
    """Response from agent execution"""
    result: dict
    execution_time: float
    agent_id: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str


class StreamEvent(BaseModel):
    """Event streamed via SSE"""
    event_type: str  # 'thinking', 'tool_call', 'result', 'error', 'keepalive'
    data: dict
    timestamp: float


# Global event queues for SSE streams
event_queues: dict[str, asyncio.Queue] = {}


# Lifecycle handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    logger.info("Cagent Sidecar starting up")
    yield
    logger.info("Cagent Sidecar shutting down")


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
    return HealthResponse(status="ok", version="1.0.0")


# Agent execution endpoint (placeholder)
@app.post("/agent/execute", response_model=AgentResponse)
async def execute_agent(request: AgentRequest):
    """
    Execute an agent with the given input.
    
    Placeholder implementation - integration with Cagent coming in 4.2.3
    """
    logger.info(f"Received agent execution request: {request.agent_id}")
    
    # TODO: Integrate with Cagent engine
    return AgentResponse(
        result={"status": "placeholder"},
        execution_time=0.0,
        agent_id=request.agent_id,
    )


# SSE streaming endpoint
async def agent_event_generator(request_id: str) -> AsyncGenerator:
    """Generate events from the agent event queue for SSE streaming"""
    # Create queue if not exists
    if request_id not in event_queues:
        event_queues[request_id] = asyncio.Queue()
    
    queue = event_queues[request_id]
    
    try:
        while True:
            try:
                # Wait for event with timeout (30s)
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                logger.info(f"Streaming event {event.event_type} for request {request_id}")
                yield {
                    "event": event.event_type,
                    "data": event.json(),
                }
                
                # Stop streaming on terminal events
                if event.event_type in ("result", "error"):
                    break
                    
            except asyncio.TimeoutError:
                # Send keepalive event to prevent connection timeout
                logger.debug(f"SSE keepalive for request {request_id}")
                yield {
                    "event": "keepalive",
                    "data": "{}",
                }
    except asyncio.CancelledError:
        logger.info(f"SSE stream cancelled for request {request_id}")
    finally:
        # Cleanup queue
        if request_id in event_queues:
            del event_queues[request_id]
        logger.info(f"SSE stream cleanup for request {request_id}")


@app.get("/agent/stream/{request_id}")
async def stream_events(request_id: str, request: Request):
    """
    Stream real-time events from agent execution via Server-Sent Events.
    
    Usage:
    - Client connects to /agent/stream/{request_id}
    - Server sends events as they occur
    - Stream ends when terminal event (result/error) is sent
    """
    logger.info(f"SSE stream started for request {request_id}")
    return EventSourceResponse(
        agent_event_generator(request_id),
        media_type="text/event-stream",
    )


# Shutdown endpoint
@app.post("/shutdown")
async def shutdown():
    """Endpoint for graceful shutdown notification"""
    logger.info("Shutdown requested, preparing cleanup")
    # TODO: Implement cleanup logic (close DB connections, save state, etc.)
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
