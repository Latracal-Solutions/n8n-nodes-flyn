import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://www.flyn.to/api';

async function flynRequest(
	this: IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
): Promise<IDataObject> {
	const options: IRequestOptions = {
		method,
		body,
		uri: `${BASE_URL}${endpoint}`,
		json: true,
	};
	if (Object.keys(body).length === 0) delete options.body;

	try {
		return (await this.helpers.requestWithAuthentication.call(
			this,
			'flynApi',
			options,
		)) as IDataObject;
	} catch (error) {
		const apiMessage =
			(error as { error?: { error?: string } }).error?.error ??
			(error as { message?: string }).message;
		throw new NodeOperationError(this.getNode(), apiMessage ?? 'Flyn API request failed');
	}
}

export class FlynTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flyn Trigger',
		name: 'flynTrigger',
		icon: 'file:flyn.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when something happens to a Flyn link',
		defaults: { name: 'Flyn Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'flynApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['link.click'],
				description: 'The Flyn events that should start this workflow',
				options: [
					{ name: 'Domain Verified', value: 'domain.verified', description: 'A custom domain finished verifying' },
					{ name: 'Link Clicked', value: 'link.click', description: 'Someone opened one of your short links' },
					{ name: 'Link Created', value: 'link.create', description: 'A new short link was created' },
					{ name: 'Link Deleted', value: 'link.delete', description: 'A short link was deleted' },
					{ name: 'Link Expired', value: 'link.expired', description: 'A short link passed its expiry date' },
					{ name: 'Link Updated', value: 'link.update', description: 'An existing short link was changed' },
				],
			},
		],
	};

	webhookMethods = {
		default: {
			/**
			 * n8n calls this before create() to avoid registering a duplicate. Flyn
			 * has no "get webhook by URL" endpoint, so we list and match on the
			 * target URL, which is unique per n8n workflow.
			 */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const staticData = this.getWorkflowStaticData('node');

				const response = await flynRequest.call(this, 'GET', '/webhooks');
				const existing = (response.webhooks ?? response.data ?? []) as IDataObject[];

				for (const hook of existing) {
					if (hook.url === webhookUrl) {
						// Re-adopt it so delete() can clean up even if the id was lost.
						staticData.webhookId = hook.id;
						return true;
					}
				}
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];
				const staticData = this.getWorkflowStaticData('node');

				const response = await flynRequest.call(this, 'POST', '/webhooks', {
					url: webhookUrl,
					events,
				});

				// The API nests the created record; accept either shape rather than
				// assuming, because losing the id here means delete() cannot clean up
				// and Flyn keeps posting to a dead n8n URL forever.
				const created = (response.webhook ?? response.data ?? response) as IDataObject;
				if (!created?.id) {
					throw new NodeOperationError(
						this.getNode(),
						'Flyn did not return a webhook ID, so the subscription could not be tracked',
					);
				}
				staticData.webhookId = created.id;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const id = staticData.webhookId as string | undefined;
				if (!id) return true;

				try {
					await flynRequest.call(this, 'DELETE', `/webhooks/${encodeURIComponent(id)}`);
				} catch {
					// Already gone, or the key lost access. Either way the local state
					// must be cleared or n8n will never try to register again.
					return false;
				} finally {
					delete staticData.webhookId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;
		return {
			workflowData: [this.helpers.returnJsonArray([body])],
		};
	}
}
