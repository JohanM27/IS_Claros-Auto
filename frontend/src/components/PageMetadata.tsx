import { useEffect } from 'react'

type PageMetadataProps = {
  title: string
  description: string
  indexable?: boolean
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export function PageMetadata({ title, description, indexable = true }: PageMetadataProps) {
  useEffect(() => {
    const pageTitle = `${title} | Claros Auto`
    document.title = pageTitle

    const robots = indexable ? 'index, follow' : 'noindex, nofollow'
    setMeta('name', 'description', description)
    setMeta('name', 'robots', robots)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', 'Claros Auto')
    setMeta('property', 'og:title', pageTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', window.location.href)
  }, [description, indexable, title])

  return null
}
