import * as sourcegraph from "sourcegraph";

import * as rpc from "vscode-ws-jsonrpc";

export function activate(): void {
  const webSocket = new WebSocket("ws://localhost:1234");
  rpc.listen({
    webSocket,
    onConnection: (connection: rpc.MessageConnection) => {
      connection.listen();

      sourcegraph.languages.registerHoverProvider(["*"], {
        provideHover: async (doc, pos) => {
          return connection
            .sendRequest<sourcegraph.Hover>("hov", doc, pos)
            .then(v => {
              console.log("recv response hov", v);
              return (
                v && {
                  contents: {
                    value:
                      "```python\n" + (v.contents as any).join("\n") + "\n```",
                    kind: sourcegraph.MarkupKind.Markdown
                  }
                }
              );
            });
        }
      });

      sourcegraph.languages.registerDefinitionProvider(["*"], {
        provideDefinition: async (doc, pos) => {
          return connection.sendRequest<any>("def", doc, pos).then(v => {
            console.log("recv response def", v);
            return (
              v &&
              new sourcegraph.Location(
                new sourcegraph.URI(doc.uri),
                new sourcegraph.Range(
                  new sourcegraph.Position(v.start.line, v.start.character),
                  new sourcegraph.Position(v.end.line, v.end.character)
                )
              )
            );
          });
        }
      });
    }
  });
}
