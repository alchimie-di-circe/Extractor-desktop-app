---
description: Comprehensive reference for Testsprite MCP tools and CLI commands.
globs: **/*
alwaysApply: true
---

# MCP Tools References

Complete reference for all TestSprite MCP Server tools available to your AI assistant.

## Core Tools

TestSprite MCP Server provides 7 core tools that work together to deliver comprehensive automated testing. Your AI assistant uses these tools automatically when you request testing.

### testsprite_bootstrap_tests

**Purpose:** Initialize testing environment and configuration

**Parameters:**
- `localPort` (number): Port where your application is running (default: 5173)
- `path` (string): Specifies a path you want to test directly, which isn’t accessible through navigation from other pages
- `type` (string): Project type – “frontend” or “backend”
- `projectPath` (string): Absolute path to your project directory
- `testScope` (string): Testing scope – “codebase” or “diff”

**Usage:**
```json
{
  "tool": "testsprite_bootstrap_tests",
  "parameters": {
    "localPort": 5173,
    "path": "/dashboard",
    "type": "frontend",
    "projectPath": "/Users/username/projects/my-app",
    "testScope": "codebase"
  }
}

```

### testsprite_generate_tests

**Purpose:** Generate comprehensive test cases for your application

**Parameters:**
- `testScope` (string): Testing scope – “codebase” or “diff”
- `testType` (string): Type of tests to generate – “unit”, “integration”, or “e2e”

**Usage:**
```json
{
  "tool": "testsprite_generate_tests",
  "parameters": {
    "testScope": "diff",
    "testType": "e2e"
  }
}
```

### testsprite_run_tests

**Purpose:** Execute generated tests against your application

**Parameters:**
- `testType` (string): Type of tests to run – “unit”, “integration”, or “e2e”
- `testScope` (string): Testing scope – “codebase” or “diff”

**Usage:**
```json
{
  "tool": "testsprite_run_tests",
  "parameters": {
    "testType": "integration",
    "testScope": "codebase"
  }
}
```

### testsprite_analyze_results

**Purpose:** Analyze test results and provide insights

**Parameters:**
- `testType` (string): Type of tests to analyze – “unit”, “integration”, or “e2e”

**Usage:**
```json
{
  "tool": "testsprite_analyze_results",
  "parameters": {
    "testType": "e2e"
  }
}


```

### testsprite_generate_report

**Purpose:** Generate a comprehensive test report

**Parameters:**
- `testType` (string): Type of tests to include in report – “unit”, “integration”, or “e2e”

**Usage:**
```json
{
  "tool": "testsprite_generate_report",
  "parameters": {
    "testType": "unit"
  }
}
```

### testsprite_cleanup

**Purpose:** Clean up testing environment and resources

**Parameters:**
- `testType` (string): Type of tests to clean up – “unit”, “integration”, or “e2e”

**Usage:**
```json
{
  "tool": "testsprite_cleanup",
  "parameters": {
    "testType": "integration"
  }
}
```

### testsprite_ask

**Purpose:** Ask questions about test results or testing process

**Parameters:**
- `question` (string): Your question about the testing process or results

**Usage:**
```json
{
  "tool": "testsprite_ask",
  "parameters": {
    "question": "What are the most common failure points in our integration tests?"
  }
}
```

## Advanced Usage

### Combining Tools for Complex Scenarios

You can combine multiple tools to create more complex testing workflows. For example, you might:
1. Use `testsprite_bootstrap_tests` to set up your testing environment
2. Run `testsprite_generate_tests` to create initial test cases
3. Execute `testsprite_run_tests` to verify the tests
4. Analyze results with `testsprite_analyze_results`
5. Generate a final report with `testsprite_generate_report`

The tools work together in a specific sequence following the complete TestSprite workflow:
Frontend

Backend

testsprite_bootstrap_tests

Read User PRD

testsprite_generate_code_summary

testsprite_generate_standardized_prd

Project Type?

testsprite_generate_frontend_test_plan

testsprite_generate_backend_test_plan

testsprite_generate_code_and_execute

Generate Test Code

Execute Tests

Results & Analysis

IDE Fixes Issues

Rerun the tests and check the fixes

​
File Structure
After running the tools, your project will have:
Expandable File Structure
my-project/
├── testsprite_tests/
│   ├── tmp/
│   │   ├── prd_files/              # Temporary PRD files
│   │   ├── config.json             # Project configuration
│   │   ├── code_summary.json       # Code analysis
│   │   ├── report_prompt.json      # AI analysis data
│   │   └── test_results.json       # Execution results
│   ├── standard_prd.json           # Product requirements
│   ├── TestSprite_MCP_Test_Report.md     # Human-readable test report
│   ├── TestSprite_MCP_Test_Report.html   # HTML test report
│   ├── TC001_Login_Success_with_Valid_Credentials.py
│   ├── TC002_Login_Failure_with_Invalid_Credentials.py
│   ├── TC003_Product_Catalog_Display.py
│   ├── TC004_View_Product_Details.py
│   ├── TC005_Purchase_Product_Success.py
│   ├── TC006_Purchase_Product_Failure.py
│   ├── TC007_Order_History_Accessibility.py
│   ├── TC008_Admin_Panel_Access_Control.py
│   └── ...                         # Additional test files
└── ...
See all 22 lines
​
Best Practices
Ensure Application is Running

The bootstrap tool checks if your app is running on the specified port
Use Absolute Paths

Always provide full absolute paths for projectPath
Authentication Setup

Provide login or authentication credentials in the TestSprite configuration portal for testing workflows
Incremental Testing

Use testIds parameter to run specific test cases
Additional Instructions

Provide context-specific instructions for better test generation
​
Common Workflows
- Full Testing Workflow

    Simply prompt your AI assistant:
    "Help you test this project with TestSprite"

    The AI will automatically:
    - Bootstrap the testing environment
    - Analyze your codebase
    - Generate comprehensive test plans
    - Execute all tests
    - Provide results and fix recommendations
​
- Targeted Testing

    For specific test cases:
"Run tests TC001 and TC002 with focus on security"

The AI will call:
testsprite_generate_code_and_execute ({
  projectName: "my-project",
  projectPath: "/path/to/project",
  testIds: ["TC001", "TC002"],
  additionalInstruction: "Focus on security vulnerabilities"
})

1. Code Readability and Maintainability
Improvements:

- Descriptive variable naming: Used testConfiguration instead of an anonymous object
- Consistent formatting: Proper indentation and alignment
- Clear structure: Logical grouping of related properties
- Comments: Added explanatory comments for each section


Benefits:

- Easier to understand the purpose of each configuration
- Simpler to maintain and update
- Better code documentation through comments
- Consistent style improves team collaboration

2. Performance Optimization
Improvements:

- Array for test IDs: Efficient iteration over test cases
- Parallel execution control: Added parallelExecution flag
- Timeout management: Explicit timeout configuration

Benefits:

- Faster test execution when parallelization is enabled
- Better resource management with timeouts
- Scalable for large test suites


3. Best Practices and Patterns
Improvements:

- Configuration object pattern: Centralized configuration management
- Default values: Sensible defaults for common scenarios
- Environment awareness: Added environment context
- Reporting configuration: Structured reporting options


Benefits:

- Follows configuration object design pattern
- Reduces repetitive code
- Consistent behavior across different environments
- Professional reporting capabilities


4. Error Handling and Edge Cases
Improvements:

- Comprehensive error handling: Dedicated error handling section
- Retry mechanism: Configurable retry logic
- Failure strategies: Multiple failure handling options
- Diagnostic tools: Screenshot capture on failures


Benefits:

- Robust error recovery: Handles unexpected failures gracefully
- Better debugging capabilities: Provides detailed error messages and stack traces
- Graceful failure handling: Allows tests to continue running even if some fail
- Improved test reliability: Reduces flaky test cases


5. Additional Enhancements
Improvements:

- Project identification: Clear project name and path
- Environment configuration: Support for different environments
- Reporting flexibility: Multiple report formats
- Verbose logging: Configurable logging levels
- Extensible structure: Easy to add new features


Benefits:

- Production-ready configuration: Ensures smooth setup for real-world scenarios
- Integration with CI/CD pipelines: Seamless automation of tests
- Better troubleshooting capabilities: Provides detailed error information
- Future-proof design: Easily extendable for future enhancements

                                                                                                                                                        
Mermaid Diagram of Improved Structure

TestConfiguration

+String projectName

+String projectPath

+String[] testIds

+Number timeout

+Number retryCount

+Boolean parallelExecution

+ErrorHandling errorHandling

+String environment

+Reporting reporting


ErrorHandling

+String onTestFailure

+Number maxRetries

+Number retryDelay

+Boolean errorLogging

+Boolean screenshotOnFailure

Reporting

+String format

+String outputPath

+Boolean verbose

The improved code provides a comprehensive, production-ready configuration structure that addresses all the requested enhancement areas while maintaining backward compatibility with the original simple structure.

    Next Steps
- Create Tests for New Projects
- First-time setup and full-suite generation
- Create Tests for New Change
- Diff-scoped testing for recent changes
- Modify or Update Tests
- Keep tests aligned with app changes