/**
 * Semantic Versioning Utility for MoonLight Strikers
 * Robust major.minor.patch numeric comparison.
 */

export function parseSemver(version) {
  if (!version || typeof version !== 'string') {
    return [0, 0, 0];
  }

  // Strip leading 'v' / 'V' and any surrounding whitespace
  const clean = version.trim().replace(/^[vV]/, '');
  
  // Extract numeric components, ignoring pre-release metadata (e.g., -beta)
  const base = clean.split('-')[0].split('+')[0];
  const parts = base.split('.').map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });

  while (parts.length < 3) {
    parts.push(0);
  }

  return parts.slice(0, 3);
}

/**
 * Compares two semantic version strings.
 * @param {string} v1 - First version (e.g., "2.0.0")
 * @param {string} v2 - Second version (e.g., "1.1.0")
 * @returns {number} 1 if v1 > v2, 0 if v1 === v2, -1 if v1 < v2
 */
export function compareSemver(v1, v2) {
  const [maj1, min1, pat1] = parseSemver(v1);
  const [maj2, min2, pat2] = parseSemver(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

/**
 * Checks if an installed version satisfies the minimum supported version.
 * @param {string} installedVersion
 * @param {string} minSupportedVersion
 * @returns {boolean}
 */
export function isVersionSupported(installedVersion, minSupportedVersion) {
  return compareSemver(installedVersion, minSupportedVersion) >= 0;
}

