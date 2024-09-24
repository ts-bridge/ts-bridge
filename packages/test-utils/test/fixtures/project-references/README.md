# Project references test

This folder contains a project with project references. It's used for end-to-end
testing of the project references parallelisation functionality. The dependency
graph is as follows:

```mermaid
%%{
  init: {
    "flowchart": {
      "curve": "bumpX"
    }
  }
}%%

graph LR;
    project-1(["Project 1"])
    project-2(["Project 2"])
    project-3(["Project 3"])
    project-4(["Project 4"])
    project-5(["Project 5"])
    project-6(["Project 6"])

    project-2 --> project-1
    project-3 --> project-1
    project-4 --> project-2
    project-5 --> project-2
```
