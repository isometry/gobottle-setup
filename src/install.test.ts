import {describe, expect, it} from 'vitest'

import {platformSlug} from './install'

describe('platformSlug', () => {
  it('maps darwin/linux and x64/arm64 onto the release matrix', () => {
    expect(platformSlug('darwin', 'arm64')).toEqual({os: 'darwin', arch: 'arm64'})
    expect(platformSlug('darwin', 'x64')).toEqual({os: 'darwin', arch: 'amd64'})
    expect(platformSlug('linux', 'x64')).toEqual({os: 'linux', arch: 'amd64'})
    expect(platformSlug('linux', 'arm64')).toEqual({os: 'linux', arch: 'arm64'})
  })

  it('rejects platforms outside the release matrix', () => {
    expect(() => platformSlug('win32', 'x64')).toThrow(/unsupported platform/)
    expect(() => platformSlug('linux', 'ia32')).toThrow(/unsupported platform/)
  })
})
