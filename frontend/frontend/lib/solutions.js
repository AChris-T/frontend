export const FAULT_SOLUTIONS = {
  pothole: {
    fix: [
      'Clean out loose debris and standing water from the hole',
      'Apply a tack coat to the edges for adhesion',
      'Fill with hot or cold-mix asphalt in compacted layers',
      'Compact flush with the surrounding surface using a plate compactor or roller',
    ],
    prevention: [
      'Seal surface cracks early before water reaches the base layer',
      'Improve drainage so water doesn’t pool on the pavement',
      'Schedule periodic resurfacing on high-traffic sections',
    ],
  },
  alligator_crack: {
    fix: [
      'Assess the subgrade and base for structural failure before patching',
      'Remove and replace the failed section as a full-depth patch',
      'Improve subsurface drainage under the repaired area',
    ],
    prevention: [
      'Enforce axle-load limits on the road where possible',
      'Maintain adequate pavement thickness during construction',
      'Repair early-stage cracking before it spreads into a network',
    ],
  },
  longitudinal_crack: {
    fix: [
      'Rout and seal the crack to keep water out',
      'Apply crack filler or hot-poured sealant along the joint',
      'Overlay the lane if cracking has become widespread',
    ],
    prevention: [
      'Ensure proper compaction at paving lane joints',
      'Seal cracks promptly once they appear',
      'Monitor known joint lines during routine inspections',
    ],
  },
  transverse_crack: {
    fix: [
      'Clean and seal the crack with a flexible joint sealant',
      'Patch if the crack has widened or spalled at the edges',
    ],
    prevention: [
      'Use a mix design suited to local temperature swings',
      'Reseal transverse joints on a regular maintenance cycle',
    ],
  },
  rutting: {
    fix: [
      'Mill down the rutted wheel paths',
      'Overlay with a rut-resistant asphalt mix',
      'Address underlying base instability if rutting recurs',
    ],
    prevention: [
      'Use stiffer, rut-resistant asphalt mixes on high-load routes',
      'Monitor and enforce vehicle load limits',
      'Improve compaction quality during original construction',
    ],
  },
  other: {
    fix: ['Have a site engineer inspect and classify the fault before repair'],
    prevention: ['Schedule regular road condition surveys to catch issues early'],
  },
};

export function solutionFor(faultType) {
  return FAULT_SOLUTIONS[faultType] || FAULT_SOLUTIONS.other;
}
