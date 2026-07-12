import {mkdtemp, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {describe, expect, it} from 'vitest'

import {parseSha256Sums, sha256File, verifyChecksum} from './verify'

// sha256 of the literal string "hello\n"
const HELLO_SHA = '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'

const SUMS = `${HELLO_SHA}  gobottle_1.0.0_darwin_arm64.zip
0000000000000000000000000000000000000000000000000000000000000000  gobottle_1.0.0_linux_amd64.zip
`

describe('parseSha256Sums', () => {
  it('parses sha256sum-format lines', () => {
    const sums = parseSha256Sums(SUMS)
    expect(sums.size).toBe(2)
    expect(sums.get('gobottle_1.0.0_darwin_arm64.zip')).toBe(HELLO_SHA)
  })

  it('ignores malformed lines', () => {
    const sums = parseSha256Sums('not a checksum line\n\ndeadbeef  short-hash\n')
    expect(sums.size).toBe(0)
  })
})

describe('verifyChecksum', () => {
  async function tempFile(content: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'gobottle-setup-test-'))
    const p = join(dir, 'file.zip')
    await writeFile(p, content)
    return p
  }

  it('accepts a matching checksum', async () => {
    const p = await tempFile('hello\n')
    expect(await sha256File(p)).toBe(HELLO_SHA)
    await expect(verifyChecksum(p, 'gobottle_1.0.0_darwin_arm64.zip', SUMS)).resolves.toBeUndefined()
  })

  it('rejects a mismatching checksum', async () => {
    const p = await tempFile('tampered\n')
    await expect(verifyChecksum(p, 'gobottle_1.0.0_darwin_arm64.zip', SUMS)).rejects.toThrow(
      /checksum mismatch/
    )
  })

  it('rejects a missing SHA256SUMS entry', async () => {
    const p = await tempFile('hello\n')
    await expect(verifyChecksum(p, 'gobottle_9.9.9_darwin_arm64.zip', SUMS)).rejects.toThrow(
      /no entry/
    )
  })
})
