import styles from './GameFeedback.module.css'

export interface GameFeedbackMessage {
  id: number
  text: string
  tone: 'combo' | 'b2b' | 'level' | 'neutral'
}

interface GameFeedbackProps {
  messages: GameFeedbackMessage[]
}

export const GameFeedback = ({ messages }: GameFeedbackProps) => {
  if (messages.length === 0) {
    return null
  }

  return (
    <div className={styles.wrap} aria-live="polite" aria-atomic="true">
      {messages.map((message) => (
        <div key={message.id} className={`${styles.message} ${styles[message.tone]}`}>
          {message.text}
        </div>
      ))}
    </div>
  )
}
