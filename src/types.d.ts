declare namespace NodeJS {
  export interface ProcessEnv {
    [key: string]: string
  }
}

module 'modern-rcon'

interface MojangUser {
  name: string
  id: string
}
