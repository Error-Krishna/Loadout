import type {
  DatasetProfile,
  AnalysisConfiguration,
  RecommendationCard,
} from '../../types/dataset';

export function rankRecommendations(
  profile: DatasetProfile,
  config: AnalysisConfiguration,
): RecommendationCard[] {
  const cards: RecommendationCard[] = [];
  const { rowCount, columnCount, estimatedDomNodes, rawSizeBytes } = profile;
  const { goal, deviceTarget, maxMemoryMb } = config;

  // 1. Virtualization candidate
  if (rowCount >= 300 || estimatedDomNodes >= 2500) {
    let score = 80;
    if (goal === 'first-render') score += 12;
    if (goal === 'memory') score += 10;
    if (deviceTarget === 'mobile-constrained') score += 8;
    if (rowCount > 10000) score += 5;

    cards.push({
      id: 'rec-virtualization',
      technique: 'Row Virtualization (TanStack Virtual)',
      category: 'rendering',
      fitRationale: `Dataset contains ${rowCount.toLocaleString()} rows (~${estimatedDomNodes.toLocaleString()} DOM nodes). Unvirtualized rendering would saturate browser layout cycles.`,
      evidence: `Estimated DOM node count drops from ~${estimatedDomNodes.toLocaleString()} to constant ~200 nodes (viewport only).`,
      score: Math.min(score, 98),
      confidence: rowCount > 2000 ? 'high' : 'medium',
      benefits: [
        'Constant O(1) DOM footprint regardless of total row count',
        'Sub-16ms initial mount time (< 1 frame budget)',
        'Fluid 60 FPS scrolling responsiveness',
      ],
      tradeoffs: [
        'Browser native Ctrl+F cannot locate unmounted offscreen rows',
        'Dynamic cell wrapping requires measureElement ref hooks',
        'Requires keyboard focus preservation across unmounts',
      ],
      prerequisites: [
        'Container with fixed or bounded height',
        '@tanstack/react-virtual or similar',
      ],
      complexity: 'medium',
      isTopPick: false,
    });
  }

  // 2. Web Worker Search candidate
  if (rowCount >= 500 || rawSizeBytes >= 80_000) {
    let score = 75;
    if (goal === 'interaction') score += 18;
    if (goal === 'balanced') score += 10;
    if (deviceTarget === 'mobile-constrained') score += 8;

    cards.push({
      id: 'rec-worker-search',
      technique: 'Web Worker Search Offloading',
      category: 'compute',
      fitRationale: `Multi-column search across ${columnCount} columns and ${rowCount.toLocaleString()} records blocks the browser main thread during typing.`,
      evidence:
        'Offloads 100% of filtering compute cycles to a background thread, maintaining 0ms UI lock time.',
      score: Math.min(score, 96),
      confidence: 'high',
      benefits: [
        'Zero main-thread blocking during rapid keystroke input',
        'Guaranteed smooth UI typing response',
        'Built-in request sequence cancellation suppresses stale results',
      ],
      tradeoffs: [
        'Structured clone message passing overhead (mitigated by returning row indices)',
        'Asynchronous state reconciliation',
        'Worker lifecycle termination on component unmount',
      ],
      prerequisites: ['Vite or bundler module worker support', 'Dual-mode fallback hook'],
      complexity: 'medium',
      isTopPick: false,
    });
  }

  // 3. Progressive Chunking candidate
  if (rowCount >= 100 && rowCount <= 15000) {
    let score = 70;
    if (goal === 'first-render') score += 8;
    if (deviceTarget === 'mobile-constrained') score += 10;
    if (rowCount < 3000) score += 6;

    cards.push({
      id: 'rec-progressive-chunking',
      technique: 'Progressive Chunking (Time-Slicing)',
      category: 'rendering',
      fitRationale:
        'Mounts data batches non-blockingly during browser idle frames using requestIdleCallback, avoiding viewport scroll container restrictions.',
      evidence: `Initial paint mounts only the first batch (< 100 rows), yielding to browser events between chunks.`,
      score: Math.min(score, 90),
      confidence: 'medium',
      benefits: [
        'Zero dependencies (native requestIdleCallback API)',
        'Full document DOM presence preserves native browser Ctrl+F and print layout',
        'No scroll container or fixed height required',
      ],
      tradeoffs: [
        'DOM memory grows linearly as chunks complete mounting',
        'Unsuitable for extreme workloads exceeding 20,000 rows',
      ],
      prerequisites: ['Resilient idle scheduler fallback for Safari / test runners'],
      complexity: 'low',
      isTopPick: false,
    });
  }

  // 4. Data Normalization & Column Pruning candidate
  if (columnCount >= 10 || (estimatedDomNodes > 5000 && maxMemoryMb < 40)) {
    let score = 65;
    if (goal === 'memory') score += 18;
    if (maxMemoryMb < 30) score += 10;

    cards.push({
      id: 'rec-data-normalization',
      technique: 'Schema Pruning & Data Normalization',
      category: 'storage',
      fitRationale: `Workload contains ${columnCount} columns. Rendering all attributes increases per-row object allocation and cell node counts.`,
      evidence: 'Reduces memory overhead by 30-50% by projecting only active viewport columns.',
      score: Math.min(score, 88),
      confidence: 'medium',
      benefits: [
        'Lowers JavaScript heap allocation',
        'Faster JSON parsing and garbage collection',
        'Less memory pressure on low-tier mobile devices',
      ],
      tradeoffs: [
        'Requires projection layer before rendering',
        'May require column picker UI for user customization',
      ],
      prerequisites: ['Data projection helper or schema transformer'],
      complexity: 'low',
      isTopPick: false,
    });
  }

  // Sort descending by score
  cards.sort((a, b) => b.score - a.score);

  // Mark highest ranked card as top pick
  if (cards.length > 0 && cards[0]) {
    cards[0].isTopPick = true;
  }

  return cards;
}
