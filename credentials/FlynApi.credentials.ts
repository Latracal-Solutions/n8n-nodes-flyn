import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FlynApi implements ICredentialType {
	name = 'flynApi';

	displayName = 'Flyn API';

	documentationUrl = 'https://www.flyn.to/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Flyn API key, which starts with flyn_sk_live_. Create one at Settings &gt; API Keys in the Flyn dashboard. API keys require a paid plan (Pro, Lifetime or Team).',
		},
	];

	// Flyn authenticates with a Bearer token on every request.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// Listing a single link is the cheapest call that proves the key works: a
	// valid key returns 200, a revoked or malformed one returns 401. There is no
	// identity endpoint to hit instead, so this doubles as the connection test.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://www.flyn.to/api',
			url: '/links',
			qs: { limit: 1 },
		},
	};
}
