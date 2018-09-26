import * as sourcegraph from 'sourcegraph'
import * as rpc from 'vscode-ws-jsonrpc'
import { BehaviorSubject, Unsubscribable, Subscription, EMPTY, of } from 'rxjs'
import { map, switchMap, distinct, distinctUntilChanged } from 'rxjs/operators'

interface FullSettings {
    'graphql.langserver-address': string
}

type Settings = Partial<FullSettings>

function connectTo(address: string): Promise<rpc.MessageConnection> {
    return new Promise(resolve => {
        const webSocket = new WebSocket('ws://' + address)
        rpc.listen({
            webSocket,
            onConnection: (connection: rpc.MessageConnection) => {
                resolve(connection)
            },
        })
    })
}

export function activate(): void {
    const address = sourcegraph.configuration.get<Settings>().get('graphql.langserver-address')
    if (!address) {
        console.log('No graphql.langserver-address was set, exiting.')
        return
    }
    console.log('Connecting to', address)

    connectTo(address).then((connection: rpc.MessageConnection) => {
        console.log('Connected')
        connection.listen()

        sourcegraph.languages.registerHoverProvider(['*'], {
            provideHover: async (doc, pos) => {
                return connection.sendRequest<sourcegraph.Hover>('hover', doc, pos).then(hover => {
                    return (
                        hover && {
                            contents: {
                                value: '```python\n' + (hover.contents as any).join('\n') + '\n```',
                                kind: sourcegraph.MarkupKind.Markdown,
                            },
                        }
                    )
                })
            },
        })

        sourcegraph.languages.registerDefinitionProvider(['*'], {
            provideDefinition: async (doc, pos) => {
                return connection.sendRequest<any>('definition', doc, pos).then(definition => {
                    return (
                        definition &&
                        new sourcegraph.Location(
                            new sourcegraph.URI(doc.uri),
                            new sourcegraph.Range(
                                new sourcegraph.Position(definition.start.line, definition.start.character),
                                new sourcegraph.Position(definition.end.line, definition.end.character)
                            )
                        )
                    )
                })
            },
        })
    })
}
