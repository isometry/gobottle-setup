import {describe, expect, it} from 'vitest'

import {selectRelease, type Release} from './resolve'

function rel(tag: string, prerelease = false): Release {
  return {tag, prerelease, assets: []}
}

const releases: Release[] = [
  rel('v2.1.0'),
  rel('v2.0.0'),
  rel('v1.10.2'),
  rel('v1.10.0'),
  rel('v1.9.9'),
  rel('v1.11.0-rc.1', true),
  rel('v0.2.0')
]

describe('selectRelease', () => {
  it('resolves exact versions with or without v prefix', () => {
    expect(selectRelease(releases, '1.10.0').tag).toBe('v1.10.0')
    expect(selectRelease(releases, 'v1.9.9').tag).toBe('v1.9.9')
  })

  it('resolves an exactly-pinned prerelease', () => {
    expect(selectRelease(releases, '1.11.0-rc.1').tag).toBe('v1.11.0-rc.1')
  })

  it('resolves major prefix to newest matching stable', () => {
    expect(selectRelease(releases, '1').tag).toBe('v1.10.2')
    expect(selectRelease(releases, 'v2').tag).toBe('v2.1.0')
  })

  it('resolves major.minor prefix to newest matching stable', () => {
    expect(selectRelease(releases, '1.10').tag).toBe('v1.10.2')
    expect(selectRelease(releases, '0.2').tag).toBe('v0.2.0')
  })

  it('never resolves a prefix to a prerelease', () => {
    // v1.11.0-rc.1 is newest in the 1.x line but must not win; and a prefix
    // whose only inhabitant is a prerelease matches nothing.
    expect(selectRelease(releases, '1').tag).toBe('v1.10.2')
    expect(() => selectRelease(releases, '1.11')).toThrow(/no release matches/)
  })

  it('errors with available versions on no match', () => {
    expect(() => selectRelease(releases, '9')).toThrow(/no release matches.*available: 2\.1\.0/)
  })

  it('rejects malformed specs', () => {
    expect(() => selectRelease(releases, 'newest')).toThrow(/invalid version spec/)
    expect(() => selectRelease(releases, '1.2.3.4')).toThrow(/invalid version spec/)
  })

  it('ignores non-semver tags', () => {
    const mixed = [...releases, rel('nightly'), rel('v1')]
    expect(selectRelease(mixed, '1').tag).toBe('v1.10.2')
  })
})
