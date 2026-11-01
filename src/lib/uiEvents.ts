// Window events that let any control open app-wide surfaces without prop drilling.
export const OPEN_ASSISTANT = 'inchstone:assistant-open'
export const OPEN_COMMAND = 'inchstone:command-open'

export const openAssistant = () => window.dispatchEvent(new Event(OPEN_ASSISTANT))
export const openCommand = () => window.dispatchEvent(new Event(OPEN_COMMAND))
