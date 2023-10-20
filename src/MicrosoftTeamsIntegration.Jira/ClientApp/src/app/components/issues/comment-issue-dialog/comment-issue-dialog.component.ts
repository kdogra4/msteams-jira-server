﻿import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { MatDialogConfig, MatDialog } from '@angular/material/dialog';
import {ActivatedRoute, Router} from '@angular/router';
import { IssueCommentService } from '@core/services/entities/comment.service';
import { IssueAddCommentOptions } from '@core/models/Jira/issue-comment-options.model';
import { ApiService, ErrorService, AppInsightsService } from '@core/services';
import { Issue } from '@core/models';
import { ConfirmationDialogData, DialogType } from '@core/models/dialogs/issue-dialog.model';
import { ConfirmationDialogComponent } from '@app/components/issues/confirmation-dialog/confirmation-dialog.component';
import * as microsoftTeams from '@microsoft/teams-js';
import { StringValidators } from '@core/validators/string.validators';
import { DomSanitizer } from '@angular/platform-browser';
import {JiraPermissionName} from "@core/models/Jira/jira-permission.model";
import {PermissionService} from "@core/services/entities/permission.service";

@Component({
    selector: 'app-comment-issue-dialog',
    templateUrl: './comment-issue-dialog.component.html',
    styleUrls: ['./comment-issue-dialog.component.scss']
})
export class CommentIssueDialogComponent implements OnInit {
    public issue: Issue;
    public errorMessage: string;
    public loading = false;
    public commentForm: FormGroup;
    private dialogDefaultSettings: MatDialogConfig = {
        width: '270px',
        height: '200px',
        minWidth: '250px',
        minHeight: '170px',
        ariaLabel: 'Confirmation dialog',
        closeOnNavigation: true,
        autoFocus: false,
        role: 'dialog'
    };

    public jiraUrl: string;
    public jiraId: string;
    public issueId: string;
    public issueKey: string;

    constructor(
        public dialog: MatDialog,
        public domSanitizer: DomSanitizer,
        private commentService: IssueCommentService,
        private route: ActivatedRoute,
        private apiService: ApiService,
        private appInsightsService: AppInsightsService,
        private permissionService: PermissionService,
        private router: Router,
        private errorService: ErrorService
    ) { }

    public async ngOnInit() {
        this.loading = true;
        try {
            const { jiraUrl, jiraId, issueId, issueKey } = this.route.snapshot.params;
            this.jiraUrl = jiraUrl;
            this.jiraId = jiraId;
            this.issueId = issueId;
            this.issueKey = issueKey;
            const commentRelatedPermissions: JiraPermissionName[] = [
               'ADD_COMMENTS',
            ];

            const { permissions } = await this.permissionService
                .getMyPermissions(this.jiraId, commentRelatedPermissions, this.issueId);

            if (!permissions.ADD_COMMENTS.havePermission) {
                const message = 'You don\'t have permissions to add comments';
                await this.router.navigate(['/error'], { queryParams: { message } });
                return;
            }

            this.issue = await this.apiService.getIssueByIdOrKey(this.jiraId, this.issueId);
            await this.createForm();
        } catch (error) {
            this.appInsightsService.trackException(
                new Error(error),
                'CommentIssueDialogData::ngOnInit'
            );
        }

        this.loading = false;
    }

    public async onSubmit(): Promise<void> {
        if (this.commentForm.invalid) {
            return;
        }

        this.errorMessage = '';

        const options: IssueAddCommentOptions = {
            jiraUrl: this.jiraId,
            issueIdOrKey: this.issueId,
            comment: this.commentForm.value.comment,
            metadataRef: null
        };

        try {
            const response = await this.commentService.addComment(options);

            if (response && response.body) {
                this.openConfirmationDialog();
                return;
            }
        } catch (error) {
            const errorMessage = this.errorService.getHttpErrorMessage(error);
            this.errorMessage = errorMessage ||
                'Comment cannot be added. Issue does not exist or you do not have permission to see it.';
        }
    }

    public get comment(): AbstractControl {
        return this.commentForm.get('comment');
    }

    public get keyLink(): string {
        return encodeURI(`${this.jiraUrl}/browse/${this.issue.key}`);
    }
    
    public get summary(): string {
        let maxLenght = 110;
        return (this.issue.fields.summary.length > maxLenght) ? this.issue.fields.summary.slice(0, maxLenght-1) + '...' : this.issue.fields.summary;
    }

    private openConfirmationDialog(): void {
        const dialogConfig = {
            ...this.dialogDefaultSettings,
            ...{
                data: {
                    title: 'Comment added',
                    // eslint-disable-next-line max-len
                    subtitle: `View <a href="${this.jiraUrl}\\browse\\${this.issueKey}" target="_blank" rel="noreferrer noopener">${this.issueKey}</a>.`,
                    buttonText: 'Dismiss',
                    dialogType: DialogType.SuccessLarge
                } as ConfirmationDialogData
            }
        };

        this.dialog.open(ConfirmationDialogComponent, dialogConfig)
            .afterClosed().subscribe(() => {
                microsoftTeams.tasks.submitTask();
            });
    }

    private async createForm(): Promise<void> {
        this.commentForm = new FormGroup({
            comment: new FormControl('',[Validators.required, StringValidators.isNotEmptyString])
        });
    }
}
