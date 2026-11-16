import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the initial Claros Auto screen', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('Claros Auto')
  })
})
