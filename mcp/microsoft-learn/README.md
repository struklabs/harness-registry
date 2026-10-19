# Microsoft Learn MCP configuration

StrukLabs maintains this configuration for Microsoft's official documentation
server: <https://learn.microsoft.com/en-us/training/support/mcp>.

In Harness MCP settings, add `https://learn.microsoft.com/api/mcp` with transport
`http`, or merge the `mcpServers` map in `config.json` into your local config.
No local runtime, package installation, or credentials are required. Enable the
server and discover its documentation search/fetch and code sample tools.

The catalog version tracks this configuration, not Microsoft's hosted deployment.
MIT covers the configuration; Microsoft's service has its own published terms.
The declared host documents the connection; JS tool sandbox permissions do not
constrain the remote server.
