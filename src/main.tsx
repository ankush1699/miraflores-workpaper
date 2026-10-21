import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { StoreProvider } from './store/Store'
import { Shell } from './ui/Shell'
import { UiProvider } from './ui/Ui'
import './index.css'

// A hash router keeps the app deployable on any static host without server rewrites.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <StoreProvider>
        <UiProvider>
          <Shell />
        </UiProvider>
      </StoreProvider>
    </HashRouter>
  </React.StrictMode>,
)
