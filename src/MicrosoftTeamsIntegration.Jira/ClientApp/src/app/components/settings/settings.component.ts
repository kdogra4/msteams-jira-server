﻿import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';


import {
    ApiService,
    ErrorService,
    AppInsightsService,
    UtilService
} from '@core/services';
import * as microsoftTeams from '@microsoft/teams-js';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
    public username: string | any;
    private jiraUrl: string | any;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private apiService: ApiService,
        private errorService: ErrorService,
        private appInsightsService: AppInsightsService,
        private utilService: UtilService
    ) { }

    public async ngOnInit(): Promise<void> {
        this.appInsightsService.logNavigation('SettingsComponent', this.route);

        this.parseParams();

        try {
            await this.setUserSettings();
            microsoftTeams.app.notifySuccess();
        } catch (error) {
            this.errorService.showDefaultError(error as any);
        }
    }

    public async signOut(): Promise<void> {
        await this.router.navigate(
            ['/settings/signout-dialog', { ...this.route.snapshot.params, jiraUrl: this.jiraUrl }]);
    }

    private parseParams(): void {
        const { jiraUrl, displayName } = this.route.snapshot.params;
        this.jiraUrl = jiraUrl;
        this.username = displayName;
    }

    private async setUserSettings(): Promise<void> {
        if (!this.username) {
            const { displayName, accountId } = await this.apiService.getMyselfData(this.jiraUrl);
            this.username = displayName;
        }
    }
}
