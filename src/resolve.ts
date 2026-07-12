import * as semver from 'semver'

export interface ReleaseAsset {
  name: string
  url: string // API asset URL; download with Accept: application/octet-stream
}

export interface Release {
  tag: string
  prerelease: boolean
  assets: ReleaseAsset[]
}

const API = 'https://api.github.com'

async function apiGet(path: string, token: string): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28'
    }
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${path}: ${res.status} ${res.statusText}`)
  }
  return res
}

function toRelease(r: {
  tag_name: string
  prerelease: boolean
  draft: boolean
  assets: {name: string; url: string}[]
}): Release {
  return {
    tag: r.tag_name,
    prerelease: r.prerelease,
    assets: r.assets.map(a => ({name: a.name, url: a.url}))
  }
}

/** Fetch all (non-draft) releases of a repository, newest first. */
export async function fetchReleases(repository: string, token: string): Promise<Release[]> {
  const releases: Release[] = []
  for (let page = 1; ; page++) {
    const res = await apiGet(`/repos/${repository}/releases?per_page=100&page=${page}`, token)
    const batch = (await res.json()) as Parameters<typeof toRelease>[0][]
    releases.push(...batch.filter(r => !r.draft).map(toRelease))
    if (batch.length < 100) break
  }
  return releases
}

/** Fetch the latest (non-draft, non-prerelease) release. */
export async function fetchLatestRelease(repository: string, token: string): Promise<Release> {
  const res = await apiGet(`/repos/${repository}/releases/latest`, token)
  return toRelease((await res.json()) as Parameters<typeof toRelease>[0])
}

/**
 * Select the release satisfying `spec` from `releases`.
 *
 * - exact (1.2.3, v1.2.3, including prerelease pins like 1.2.3-rc.1):
 *   the release with that exact version;
 * - prefix (1, 1.2): the newest matching stable release;
 * - anything else is an error.
 */
export function selectRelease(releases: Release[], spec: string): Release {
  const bare = spec.trim().replace(/^v/, '')

  const byVersion = new Map<string, Release>()
  for (const r of releases) {
    const v = semver.valid(semver.clean(r.tag))
    if (v) byVersion.set(v, r)
  }

  const exact = semver.valid(bare)
  if (exact) {
    const hit = byVersion.get(exact)
    if (hit) return hit
    return fail(byVersion, spec)
  }

  if (/^\d+(\.\d+)?$/.test(bare)) {
    // "1" and "1.2" are X-ranges in semver (1.x.x / 1.2.x); prereleases are
    // excluded by default, per the pinning contract.
    const stable = [...byVersion.keys()].filter(v => !semver.prerelease(v))
    const best = semver.maxSatisfying(stable, bare)
    if (best) return byVersion.get(best) as Release
    return fail(byVersion, spec)
  }

  throw new Error(
    `invalid version spec ${JSON.stringify(spec)}: use 'latest', an exact version (1.2.3), or a prefix (1, 1.2)`
  )
}

function fail(byVersion: Map<string, Release>, spec: string): never {
  const available = [...byVersion.keys()].sort(semver.rcompare).slice(0, 10)
  throw new Error(
    `no release matches version ${JSON.stringify(spec)}; available: ${
      available.length ? available.join(', ') : '(none)'
    }`
  )
}

/** Resolve a version spec to a concrete release. */
export async function resolveRelease(
  spec: string,
  repository: string,
  token: string
): Promise<Release> {
  if (spec.trim().toLowerCase() === 'latest') {
    return fetchLatestRelease(repository, token)
  }
  return selectRelease(await fetchReleases(repository, token), spec)
}
