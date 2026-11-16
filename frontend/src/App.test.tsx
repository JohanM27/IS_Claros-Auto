import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the initial Claros Auto screen', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(markup).toContain('Claros Auto')
  })
})
