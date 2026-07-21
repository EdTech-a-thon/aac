export type Vocabulary = {
	id: string;
	name: string;
	displayName: string;
	created_at: string;
	updated_at: string;
};

export type Manager = {
	userId: string;
	email: string | null;
	name: string | null;
	createdAt: string;
};
