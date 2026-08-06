export interface Cache<V = unknown> {
	get(key: string): Promise<V | undefined>;
	set(key: string, value: V, ttlMs?: number): Promise<void>;
	delete(key: string): Promise<void>;
}
