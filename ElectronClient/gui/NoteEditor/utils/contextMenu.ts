import ResourceEditWatcher from '../../../lib/services/ResourceEditWatcher';

const { bridge } = require('electron').remote.require('./bridge');
const Menu = bridge().Menu;
const MenuItem = bridge().MenuItem;
const Resource = require('lib/models/Resource.js');
const fs = require('fs-extra');
const { clipboard } = require('electron');
const { toSystemSlashes } = require('lib/path-utils');
const { _ } = require('lib/locale');

export enum ContextMenuItemType {
	None = '',
	Image = 'image',
	Resource = 'resource',
	Text = 'text',
	Link = 'link',
}

export interface ContextMenuOptions {
	itemType: ContextMenuItemType,
	resourceId: string,
	textToCopy: string,
}

interface ContextMenuItem {
	label: string,
	onAction: Function,
	isActive: Function,
}

interface ContextMenuItems {
	[key:string]: ContextMenuItem;
}

async function resourceInfo(options:ContextMenuOptions):Promise<any> {
	const resource = options.resourceId ? await Resource.load(options.resourceId) : null;
	const resourcePath = resource ? Resource.fullPath(resource) : '';
	return { resource, resourcePath };
}

export function menuItems():ContextMenuItems {
	return {
		open: {
			label: _('Open...'),
			onAction: async (options:ContextMenuOptions) => {
				try {
					await ResourceEditWatcher.instance().openAndWatch(options.resourceId);
				} catch (error) {
					console.error(error);
					bridge().showErrorMessageBox(error.message);
				}
			},
			isActive: (itemType:ContextMenuItemType) => itemType === ContextMenuItemType.Image || itemType === ContextMenuItemType.Resource,
		},
		saveAs: {
			label: _('Save as...'),
			onAction: async (options:ContextMenuOptions) => {
				const { resourcePath, resource } = await resourceInfo(options);
				const filePath = bridge().showSaveDialog({
					defaultPath: resource.filename ? resource.filename : resource.title,
				});
				if (!filePath) return;
				await fs.copy(resourcePath, filePath);
			},
			isActive: (itemType:ContextMenuItemType) => itemType === ContextMenuItemType.Image || itemType === ContextMenuItemType.Resource,
		},
		revealInFolder: {
			label: _('Reveal file in folder'),
			onAction: async (options:ContextMenuOptions) => {
				const { resourcePath } = await resourceInfo(options);
				bridge().showItemInFolder(resourcePath);
			},
			isActive: (itemType:ContextMenuItemType) => itemType === ContextMenuItemType.Image || itemType === ContextMenuItemType.Resource,
		},
		copyPathToClipboard: {
			label: _('Copy path to clipboard'),
			onAction: async (options:ContextMenuOptions) => {
				const { resourcePath } = await resourceInfo(options);
				clipboard.writeText(toSystemSlashes(resourcePath));
			},
			isActive: (itemType:ContextMenuItemType) => itemType === ContextMenuItemType.Image || itemType === ContextMenuItemType.Resource,
		},
		copy: {
			label: _('Copy'),
			onAction: async (options:ContextMenuOptions) => {
				clipboard.writeText(options.textToCopy);
			},
			isActive: (itemType:ContextMenuItemType) => itemType === ContextMenuItemType.Text,
		},
		copyLinkUrl: {
			label: _('Copy Link Address'),
			onAction: async (options:ContextMenuOptions) => {
				clipboard.writeText(options.textToCopy);
			},
			isActive: (itemType:ContextMenuItemType) => itemType === ContextMenuItemType.Link,
		},
	};
}

export default async function contextMenu(options:ContextMenuOptions) {
	const menu = new Menu();

	const items = menuItems();

	for (const itemKey in items) {
		const item = items[itemKey];

		if (!item.isActive(options.itemType)) continue;

		menu.append(new MenuItem({
			label: item.label,
			click: () => {
				item.onAction(options);
			},
		}));
	}

	return menu;
}
