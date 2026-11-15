import {Server, Socket} from 'socket.io'
import {ClientToServerEvents, ServerToClientEvents} from '../../spec/types'

// What the server remembers about a socket: nothing until it joined a room
export type SocketData =
    | {
          ok: true
          id: string
          user: string
          room: string
          session: string
      }
    | {ok: false; id: string; room?: never; user?: never; session?: never}

// The user of a socket that joined a room
export type Me = {room: string; user: string}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
