import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import type { IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { SPPermission } from '@microsoft/sp-page-context';
import { initializeIcons } from '@fluentui/font-icons-mdl2';

import * as strings from 'CompanyStoreWebPartStrings';
import CompanyStore from './components/CompanyStore';
import { ICompanyStoreProps } from './components/ICompanyStoreProps';
import { createSP, SPFI } from './sp';
import { everyoneClaim } from './setup/permissions';
import type { ISiteInfo } from './setup/problems';

export interface ICompanyStoreWebPartProps {}

export default class CompanyStoreWebPart extends BaseClientSideWebPart<ICompanyStoreWebPartProps> {

  private _sp: SPFI | undefined;
  private _site: ISiteInfo | undefined;

  public render(): void {
    if (!this._sp || !this._site) return;
    const element: React.ReactElement<ICompanyStoreProps> = React.createElement(
      CompanyStore,
      {
        sp: this._sp,
        site: this._site,
        getGraph: () => this.context.msGraphClientFactory.getClient('3')
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected async onInit(): Promise<void> {
    await super.onInit();
    // SharePoint's icon font. Pages usually have it already; this makes sure, without warning when they do.
    initializeIcons(undefined, { disableWarnings: true });
    const page = this.context.pageContext;
    const tenantId = page.aadInfo?.tenantId?.toString() || page.legacyPageContext.aadTenantId;

    this._sp = createSP(this.context);
    this._site = {
      webUrl: page.web.absoluteUrl,
      webServerRelativeUrl: page.web.serverRelativeUrl,
      everyoneLogin: everyoneClaim(tenantId),
      currentUserId: page.legacyPageContext.userId,
      user: { name: page.user.displayName, email: page.user.email },
      isOwner: page.web.permissions.hasAllPermissions(SPPermission.manageLists, SPPermission.managePermissions),
      pageUrl: window.location.href.split(/[?#]/)[0]
    };
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
    }

  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: []
        }
      ]
    };
  }
}
