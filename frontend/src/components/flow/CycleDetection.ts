/**
 * Flow Dependency Cycle Detection & Analysis
 * Detects circular dependencies and provides visualization
 */

import React from 'react';
import { FlowEvent, FlowDependency } from '@/types/flow';

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: string[][];
  criticalPath: string[];
  eventDependencyCount: Record<string, number>;
}

export interface DependencyGraph {
  adjacencyList: Map<string, string[]>;
  reverseList: Map<string, string[]>;
}

/**
 * Build dependency graph from flow dependencies
 */
export function buildDependencyGraph(dependencies: FlowDependency[]): DependencyGraph {
  const adjacencyList = new Map<string, string[]>();
  const reverseList = new Map<string, string[]>();

  dependencies.forEach((dep) => {
    if (!adjacencyList.has(dep.from_event_id)) {
      adjacencyList.set(dep.from_event_id, []);
    }
    adjacencyList.get(dep.from_event_id)!.push(dep.to_event_id);

    if (!reverseList.has(dep.to_event_id)) {
      reverseList.set(dep.to_event_id, []);
    }
    reverseList.get(dep.to_event_id)!.push(dep.from_event_id);
  });

  return { adjacencyList, reverseList };
}

/**
 * Detect cycles using DFS (Depth-First Search)
 */
export function detectCycles(dependencies: FlowDependency[], events: FlowEvent[]): CycleDetectionResult {
  const graph = buildDependencyGraph(dependencies);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  const eventDependencyCount: Record<string, number> = {};

  events.forEach((event) => {
    eventDependencyCount[event.id] = 0;
  });

  dependencies.forEach((dep) => {
    eventDependencyCount[dep.to_event_id] =
      (eventDependencyCount[dep.to_event_id] || 0) + 1;
  });

  /**
   * DFS to find cycles
   */
  function dfs(
    nodeId: string,
    path: string[] = []
  ): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.adjacencyList.get(nodeId) || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex);
        cycle.push(neighbor); // Complete the cycle
        cycles.push(cycle);
      }
    }

    recursionStack.delete(nodeId);
  }

  // Run DFS from each unvisited node
  events.forEach((event) => {
    if (!visited.has(event.id)) {
      dfs(event.id);
    }
  });

  // Compute critical path (longest path in DAG)
  const criticalPath = computeCriticalPath(graph, events);

  return {
    hasCycles: cycles.length > 0,
    cycles: cycles.map((c) => c.filter((id, i) => i < c.length - 1)), // Remove duplicate end node
    criticalPath,
    eventDependencyCount,
  };
}

/**
 * Compute critical path (longest chain of dependencies)
 * Only works correctly in DAG (acyclic graphs)
 */
function computeCriticalPath(graph: DependencyGraph, events: FlowEvent[]): string[] {
  // Topological sort
  const inDegree: Record<string, number> = {};
  const queue: string[] = [];

  events.forEach((event) => {
    inDegree[event.id] = 0;
  });

  graph.adjacencyList.forEach((neighbors, nodeId) => {
    neighbors.forEach((neighbor) => {
      inDegree[neighbor] = (inDegree[neighbor] || 0) + 1;
    });
  });

  // Find all nodes with in-degree 0
  events.forEach((event) => {
    if (inDegree[event.id] === 0) {
      queue.push(event.id);
    }
  });

  // Track longest path to each node
  const longestPath: Record<string, string[]> = {};
  events.forEach((event) => {
    longestPath[event.id] = [event.id];
  });

  while (queue.length > 0) {
    const node = queue.shift()!;
    const neighbors = graph.adjacencyList.get(node) || [];

    neighbors.forEach((neighbor) => {
      // Update longest path
      if (
        longestPath[node].length + 1 > longestPath[neighbor].length
      ) {
        longestPath[neighbor] = [...longestPath[node], neighbor];
      }

      // Decrease in-degree
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Find longest path overall
  let maxPath: string[] = [];
  Object.values(longestPath).forEach((path) => {
    if (path.length > maxPath.length) {
      maxPath = path;
    }
  });

  return maxPath;
}

/**
 * Check if adding a dependency would create a cycle
 */
export function wouldCreateCycle(
  fromEventId: string,
  toEventId: string,
  dependencies: FlowDependency[]
): boolean {
  const newDependencies = [...dependencies, { from_event_id: fromEventId, to_event_id: toEventId } as FlowDependency];
  const graph = buildDependencyGraph(newDependencies);

  // Check if there's a path from toEventId back to fromEventId
  const visited = new Set<string>();
  const queue = [toEventId];
  visited.add(toEventId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === fromEventId) {
      return true; // Would create cycle
    }

    const neighbors = graph.adjacencyList.get(current) || [];
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  return false;
}

/**
 * Get all events that depend on a given event (transitive)
 */
export function getDependentEvents(
  eventId: string,
  dependencies: FlowDependency[]
): string[] {
  const dependents = new Set<string>();
  const queue = [eventId];
  const visited = new Set<string>([eventId]);

  const graph = buildDependencyGraph(dependencies);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.adjacencyList.get(current) || [];

    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        dependents.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  return Array.from(dependents);
}

/**
 * React Hook: Use cycle detection
 */
export function useCycleDetection(
  events: FlowEvent[],
  dependencies: FlowDependency[],
  newDependency?: { from: string; to: string }
) {
  const [detection, setDetection] = React.useState<CycleDetectionResult | null>(null);
  const [wouldCycle, setWouldCycle] = React.useState(false);

  React.useEffect(() => {
    const result = detectCycles(dependencies, events);
    setDetection(result);

    if (newDependency) {
      const cycle = wouldCreateCycle(newDependency.from, newDependency.to, dependencies);
      setWouldCycle(cycle);
    }
  }, [events, dependencies, newDependency]);

  return { detection, wouldCycle };
}
