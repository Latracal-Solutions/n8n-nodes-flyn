import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	IHttpRequestOptions,
	IHttpRequestMethods,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://www.flyn.to/api';

async function flynRequest(
	this: IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		body,
		url: `${BASE_URL}${endpoint}`,
		json: true,
	};
	if (Object.keys(body).length === 0) delete options.body;

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'flynApi',
			options,
		)) as IDataObject;
	} catch (error) {
		// Flyn's plan gates return a structured body worth surfacing intact: a free
		// account hitting the 25 links/month cap gets code UPGRADE_REQUIRED and an
		// upgradeUrl, which is far more useful in a run log than "403".
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export class FlynTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flyn Trigger',
		name: 'flynTrigger',
		icon: { light: 'file:flyn.svg', dark: 'file:flyn.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when something happens to a Flyn link',
		defaults: { name: 'Flyn Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
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
				} catch (error) {
					// Usually the webhook is already gone, or the key lost access, and
					// either way the local state below must still be cleared or n8n will
					// never re-register. But swallowing this silently hides the case that
					// matters: Flyn still holding a subscription that now posts into the
					// void. Log it so it is visible, then let n8n retry the deletion.
					this.logger.warn(
						`Flyn Trigger: could not delete webhook ${id}: ${(error as Error).message}`,
					);
					return false;
				} finally {
					delete staticData.webhookId;
				}
				return true;
			},
		},
	};

	// Not `async`: there is nothing to await, and n8n only requires that this
	// returns a Promise. Marking it async would be a lie the linter rightly
	// objects to.
	webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		return Promise.resolve({
			workflowData: [this.helpers.returnJsonArray([body])],
		});
	}
}
