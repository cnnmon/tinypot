/**
 * Simple async job system.
 * Jobs are fire-and-forget with callbacks for completion.
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job<T = unknown> {
  id: string;
  status: JobStatus;
  result?: T;
  error?: Error;
}

type JobExecutor<T> = () => Promise<T>;
type JobCallback<T> = (result: T) => void;
type JobErrorCallback = (error: Error) => void;

interface JobEntry<T> {
  job: Job<T>;
  onComplete?: JobCallback<T>;
  onError?: JobErrorCallback;
}

const jobs = new Map<string, JobEntry<unknown>>();

/**
 * Queue and immediately run an async job.
 * Returns the job ID for tracking.
 */
export function runJob<T>(
  id: string,
  executor: JobExecutor<T>,
  options?: {
    onComplete?: JobCallback<T>;
    onError?: JobErrorCallback;
  },
): string {
  const job: Job<T> = { id, status: 'pending' };
  const entry: JobEntry<T> = {
    job,
    onComplete: options?.onComplete,
    onError: options?.onError,
  };

  jobs.set(id, entry as JobEntry<unknown>);

  // Start execution immediately
  job.status = 'running';

  executor()
    .then((result) => {
      job.status = 'completed';
      job.result = result;
      entry.onComplete?.(result);
    })
    .catch((error) => {
      job.status = 'failed';
      job.error = error instanceof Error ? error : new Error(String(error));
      entry.onError?.(job.error);
    });

  return id;
}

/**
 * Get job status by ID.
 */
export function getJob<T = unknown>(id: string): Job<T> | null {
  const entry = jobs.get(id);
  return (entry?.job as Job<T>) ?? null;
}

/**
 * Check if a job is currently running.
 */
export function isJobRunning(id: string): boolean {
  const job = getJob(id);
  return job?.status === 'running';
}

/**
 * Clear completed/failed job from memory.
 */
export function clearJob(id: string): void {
  jobs.delete(id);
}
