import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://www.flyn.to/api';

/**
 * Every call goes through here so the Bearer header, JSON body handling and
 * error surfacing live in one place. Flyn returns a JSON `error` string on
 * failure; without this the user would see a bare status code in the run log.
 */
async function flynRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<IDataObject> {
	const options: IRequestOptions = {
		method,
		body,
		qs,
		uri: `${BASE_URL}${endpoint}`,
		json: true,
	};

	if (Object.keys(body).length === 0) {
		delete options.body;
	}

	try {
		return (await this.helpers.requestWithAuthentication.call(
			this,
			'flynApi',
			options,
		)) as IDataObject;
	} catch (error) {
		// Flyn's plan gates return a structured body worth passing through intact:
		// a free account hitting the 25 links/month cap gets `code:
		// UPGRADE_REQUIRED` plus an upgradeUrl, which is far more actionable than
		// "403".
		const apiMessage =
			(error as { error?: { error?: string } }).error?.error ??
			(error as { message?: string }).message;
		throw new NodeOperationError(this.getNode(), apiMessage ?? 'Flyn API request failed');
	}
}

export class Flyn implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flyn',
		name: 'flyn',
		icon: 'file:flyn.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create, update and track Flyn short links and QR codes',
		defaults: { name: 'Flyn' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'flynApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Link', value: 'link' },
					{ name: 'QR Code', value: 'qrCode' },
				],
				default: 'link',
			},

			// ─── Link operations ──────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['link'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a short link', action: 'Create a short link' },
					{ name: 'Delete', value: 'delete', description: 'Delete a short link', action: 'Delete a short link' },
					{ name: 'Get', value: 'get', description: 'Get a short link and its click count', action: 'Get a short link' },
					{ name: 'Get Many', value: 'getAll', description: 'Get many short links', action: 'Get many short links' },
					{ name: 'Update', value: 'update', description: 'Update a short link', action: 'Update a short link' },
				],
				default: 'create',
			},

			{
				displayName: 'Destination URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['create'] } },
				description: 'The long URL to shorten. If no protocol is given, https is assumed.',
			},
			{
				displayName: 'Link ID',
				name: 'linkId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['get', 'update', 'delete'] } },
				description: 'The ID of the link, as returned by Create or Get Many',
			},

			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['link'], operation: ['getAll'] } },
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['link'], operation: ['getAll'], returnAll: [false] } },
				description: 'Max number of results to return',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['link'], operation: ['getAll'] } },
				options: [
					{
						displayName: 'Order',
						name: 'order',
						type: 'options',
						options: [
							{ name: 'Ascending', value: 'asc' },
							{ name: 'Descending', value: 'desc' },
						],
						default: 'desc',
						description: 'Sort direction',
					},
					{ displayName: 'Search', name: 'search', type: 'string', default: '', description: 'Match links by URL, slug or title' },
					{
						displayName: 'Sort By',
						name: 'sort',
						type: 'options',
						options: [
							{ name: 'Clicks', value: 'clicks' },
							{ name: 'Created At', value: 'created_at' },
						],
						default: 'created_at',
						description: 'Field to sort by',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{ name: 'Active', value: 'active' },
							{ name: 'Expired', value: 'expired' },
						],
						default: 'active',
						description: 'Filter by link status',
					},
					{ displayName: 'Tag', name: 'tag', type: 'string', default: '', description: 'Only links carrying this tag' },
				],
			},

			// Optional fields are shared between create and update. Anything gated
			// behind a paid plan says so in its own description, because the API
			// rejects it rather than silently ignoring it, and a workflow author
			// should know that before the run fails.
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['link'], operation: ['create', 'update'] } },
				options: [
					{ displayName: 'Click Limit', name: 'clickLimit', type: 'number', default: 0, description: 'Stop redirecting after this many clicks. Requires a paid plan.' },
					{ displayName: 'Cloaking', name: 'cloaking', type: 'boolean', default: false, description: 'Whether to mask the destination behind the short URL. Requires a paid plan.' },
					{ displayName: 'Custom Back-Half', name: 'slug', type: 'string', default: '', description: 'Custom slug, so "launch" gives flyn.to/launch. Leave blank for a random one.' },
					{ displayName: 'Custom Domain', name: 'domain', type: 'string', default: '', description: 'Custom domain to build the link on. Requires a paid plan.' },
					{ displayName: 'Destination URL', name: 'url', type: 'string', default: '', description: 'A new destination for an existing link. Update only.' },
					{ displayName: 'Expires At', name: 'expiresAt', type: 'dateTime', default: '', description: 'Date and time after which the link stops redirecting' },
					{ displayName: 'Fallback URL', name: 'fallbackUrl', type: 'string', default: '', description: 'Where to send visitors once the click limit is reached. Requires a paid plan.' },
					{ displayName: 'Forward Query Parameters', name: 'forwardParams', type: 'boolean', default: false, description: 'Whether to pass query parameters through to the destination' },
					{ displayName: 'No Index', name: 'noIndex', type: 'boolean', default: false, description: 'Whether to ask search engines not to index the link. Requires a paid plan.' },
					{ displayName: 'Notes', name: 'notes', type: 'string', default: '', description: 'Internal notes for the link' },
					{ displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '', description: 'Password required before the redirect. Requires a paid plan.' },
					{ displayName: 'Preview Description', name: 'ogDescription', type: 'string', default: '', description: 'Custom description for social link previews' },
					{ displayName: 'Preview Image', name: 'ogImage', type: 'string', default: '', description: 'Custom image URL for social link previews' },
					{ displayName: 'Preview Title', name: 'ogTitle', type: 'string', default: '', description: 'Custom title for social link previews' },
					{ displayName: 'Tags', name: 'tags', type: 'string', default: '', description: 'Comma-separated tags. Requires a paid plan.' },
					{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'Internal title for the link' },
				],
			},

			// ─── QR code ──────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['qrCode'] } },
				options: [
					{ name: 'Get', value: 'get', description: 'Get the QR code for a link', action: 'Get the QR code for a link' },
				],
				default: 'get',
			},
			{
				displayName: 'Link ID',
				name: 'linkId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['qrCode'] } },
				description: 'The ID of the link to render a QR code for',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['qrCode'] } },
				options: [
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						options: [
							{ name: 'PNG', value: 'png' },
							{ name: 'SVG', value: 'svg' },
						],
						default: 'png',
						description: 'Image format. SVG requires a paid plan.',
					},
					{
						displayName: 'Size',
						name: 'size',
						type: 'number',
						default: 512,
						typeOptions: { minValue: 64, maxValue: 2048 },
						description: 'Image size in pixels, from 64 to 2048. Values outside the range are clamped rather than rejected.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject | IDataObject[] = {};

				if (resource === 'link') {
					if (operation === 'create') {
						const body: IDataObject = { url: this.getNodeParameter('url', i) as string };
						const extra = this.getNodeParameter('additionalFields', i) as IDataObject;
						Object.assign(body, normalizeFields(extra));
						responseData = await flynRequest.call(this, 'POST', '/links', body);
					} else if (operation === 'get') {
						const id = this.getNodeParameter('linkId', i) as string;
						responseData = await flynRequest.call(this, 'GET', `/links/${encodeURIComponent(id)}`);
					} else if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const filters = this.getNodeParameter('filters', i) as IDataObject;
						const qs: IDataObject = { ...filters };
						if (!returnAll) {
							qs.limit = this.getNodeParameter('limit', i) as number;
						}
						const res = await flynRequest.call(this, 'GET', '/links', {}, qs);
						// The API wraps the collection; hand n8n the array so each link
						// becomes its own item rather than one blob the user must split.
						responseData = (res.links ?? res.data ?? res) as IDataObject[];
					} else if (operation === 'update') {
						const id = this.getNodeParameter('linkId', i) as string;
						const extra = this.getNodeParameter('additionalFields', i) as IDataObject;
						responseData = await flynRequest.call(
							this,
							'PATCH',
							`/links/${encodeURIComponent(id)}`,
							normalizeFields(extra),
						);
					} else if (operation === 'delete') {
						const id = this.getNodeParameter('linkId', i) as string;
						await flynRequest.call(this, 'DELETE', `/links/${encodeURIComponent(id)}`);
						responseData = { success: true, id };
					}
				} else if (resource === 'qrCode') {
					const id = this.getNodeParameter('linkId', i) as string;
					const options = this.getNodeParameter('options', i) as IDataObject;
					responseData = await flynRequest.call(
						this,
						'GET',
						`/links/${encodeURIComponent(id)}/qr`,
						{},
						options,
					);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

/**
 * n8n collections hand back every key the user touched, including ones left at
 * their default. Empty strings and zeroes are meaningful to Flyn's PATCH (they
 * would clear a field), so drop anything the user did not actually fill in, and
 * split the comma-separated tag input into the array the API expects.
 */
function normalizeFields(fields: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === '' || value === undefined || value === null) continue;
		if (key === 'clickLimit' && value === 0) continue;
		if (key === 'tags' && typeof value === 'string') {
			const tags = value
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			if (tags.length) out.tags = tags;
			continue;
		}
		out[key] = value;
	}
	return out;
}
