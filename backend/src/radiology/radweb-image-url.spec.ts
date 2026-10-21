import { requireRadwebImageUrl } from './radweb-image-url';

describe('RadWeb image link', () => {
  it('rejects a report without an http(s) image URL', () => {
    expect(() => requireRadwebImageUrl('')).toThrow(
      'A RadWeb / image link is required before the imaging report can be saved.',
    );
    expect(() => requireRadwebImageUrl('not-a-url')).toThrow(/RadWeb/)
  })

  it('accepts an http RadWeb URL', () => {
    expect(requireRadwebImageUrl(' https://radweb.example/study/abc ')).toBe(
      'https://radweb.example/study/abc',
    )
  })
})
