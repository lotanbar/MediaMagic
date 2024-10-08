import './main.css'

import ReactDOM from 'react-dom/client'
import App from './App'
import { ExplorerProvider } from './ExplorerContext' // Update with correct path

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ExplorerProvider>
    <App />
  </ExplorerProvider>
)
