# Security

## Reporting a vulnerability

Please do not publish a working exploit or real credential in a public issue. Open a GitHub security advisory for this repository, or contact the repository owner privately through their published GitHub contact method.

Include the smallest safe reproduction you can. Use fake credentials and synthetic files.

## Scope

ShipSafe processes files locally in the browser and creates a new ZIP. A useful report includes issues that could cause it to:

- send or expose file contents over a network;
- include a file the user explicitly excluded;
- write an unsafe path into the exported ZIP;
- display a detected secret value in the interface;
- execute content from a scanned project.

ShipSafe does not claim to detect every possible secret. A missed pattern or false positive is still welcome as a normal bug report, provided the example contains no live credentials.
