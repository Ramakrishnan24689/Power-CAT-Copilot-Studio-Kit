/**
 * @function hideAndShowConversationKPISettings
 * @description Shows or hides KPI settings based on the configuration type.
 * @param {object} executionContext - The form execution context.
 */
function hideAndShowConversationKPISettings(executionContext) {
    "use strict";
    const formContext = executionContext.getFormContext();

    // Retrieve multiselect optionset values as an array
    const configurationTypeValues =
        formContext.getAttribute("cat_configurationtypescodes").getValue() || [];

    const tabGeneral = formContext.ui.tabs.get("tab_general");
    const kpiSection = tabGeneral.sections.get("tab_general_section_kpisettings");
    const fileSection = tabGeneral.sections.get("tab_general_section_file");
    const fileConfigDetailsSection = tabGeneral.sections.get(
        "tab_general_section_file_config_details"
    );
    const conversationTranscriptsSection = tabGeneral.sections.get(
        "tab_general_section_conversationtranscriptsenrichment"
    );
    const agentInsightsSection = tabGeneral.sections.get(
        "tab_general_section_agentinsights"
    );

    const kpiLogsTab = formContext.ui.tabs.get("tab_conversation_kpi_logs");

    const sectionsToHideOrShow = [
        "tab_general_section_directlinesettings",
        "tab_general_section_userauthentication",
        "tab_general_section_resultsenrichment",
        "tab_general_section_generativeaitesting",
    ];

    // Hide all sections by default
    toggleSectionVisibility(tabGeneral, sectionsToHideOrShow, false);
    kpiSection.setVisible(false);
    fileSection.setVisible(false);
    fileConfigDetailsSection.setVisible(false);
    conversationTranscriptsSection.setVisible(false);
    agentInsightsSection.setVisible(false);
    kpiLogsTab.setVisible(false);

    // Check if configuration type includes 'Conversation KPIs' (2)
    if (configurationTypeValues.includes(2)) {
        kpiSection.setVisible(true);
        kpiLogsTab.setVisible(true);
        setFieldRequirements(
            formContext,
            ["cat_copilotid", "cat_dataverseurl"],
            "required"
        );
    } else {
        setFieldRequirements(
            formContext,
            ["cat_copilotid", "cat_dataverseurl"],
            "none"
        );
    }

    // Check if configuration type includes 'Test Automation' (1)
    if (configurationTypeValues.includes(1)) {
        // Show the Conversation Transcripts section
        conversationTranscriptsSection.setVisible(true);
        toggleSectionVisibility(tabGeneral, sectionsToHideOrShow, true);
    }

    // Check if configuration type includes 'File Synchronization' (3)
    if (configurationTypeValues.includes(3)) {
        // Show the File section and File Config Details section for File Synchronization
        fileSection.setVisible(true);
        fileConfigDetailsSection.setVisible(true);
        setFieldRequirements(
            formContext,
            ["cat_copilotid", "cat_dataverseurl"],
            "required"
        );
    }

    // Hide 'Agent Insights' option (4) from configuration types for new record creation
    // const formType = formContext.ui.getFormType();
    // const configTypeControl = formContext.getControl("cat_configurationtypescodes");
    // if (configTypeControl) {
    //     if (formType === 1) {
    //         // Create mode - remove Agent Insights option
    //         //configTypeControl.removeOption(4);
    //     }
    // }

    // Check if configuration type includes 'Agent Insights' (4)
    if (configurationTypeValues.includes(4)) {
        // Show only the Agent Insights section
        agentInsightsSection.setVisible(true);
        setFieldRequirements(
            formContext,
            ["cat_agentname", "cat_copilotid", "cat_azureappinsightsapplicationid", "cat_azureappinsightsclientid", "cat_azureappinsightssecretlocationcode", "cat_dataverseurl", "cat_kpisourcecodes", "cat_iscaptureuserdetailsenabled", "cat_iscaptureuserfeedbackenabled"],
            "required"
        );
    }
}

/**
 * @function setFieldRequirements
 * @description Sets the requirement level for a list of fields.
 * @param {object} formContext - The form context.
 * @param {string[]} fieldNames - List of field names to set the requirement level.
 * @param {string} requiredLevel - The required level ("required" or "none").
 */
function setFieldRequirements(formContext, fieldNames, requiredLevel) {
    "use strict";
    fieldNames.forEach((fieldName) => {
        const attribute = formContext.getAttribute(fieldName);
        if (attribute) {
            attribute.setRequiredLevel(requiredLevel);
        }
    });
}

/**
 * @function setFieldVisibilityForEachSections
 * @description Implements the Business Rules (BR) by showing/hiding fields and setting required levels based on certain conditions.
 * @param {object} executionContext - The form execution context.
 */
function setFieldVisibilityForEachSections(executionContext) {
    "use strict";
    const formContext = executionContext.getFormContext();
    const configurationTypeValues =
        formContext.getAttribute("cat_configurationtypescodes").getValue() || [];

    // User Authentication Fields Rules
    const userAuth = formContext
        .getAttribute("cat_userauthenticationcode")
        .getValue();

    // Entra ID v2 and Test Automation
    if (userAuth === 2 && configurationTypeValues.includes(1)) {
        setFieldVisibility(
            formContext,
            ["cat_clientid", "cat_tenantid", "cat_scope", "cat_userauthsecretlocationcode"],
            true,
            "required"
        );
        clearAndHideFields(formContext, [
            "cat_agentidentifier",
            "cat_environmentid"
        ]);
        // No Authentication and Test Automation
    } else if (userAuth === 1 && configurationTypeValues.includes(1)) {
        clearAndHideFields(formContext, [
            "cat_clientid",
            "cat_tenantid",
            "cat_scope",
            "cat_userauthsecretlocationcode",
            "cat_clientsecret",
            "cat_userauthenvironmentvariable",
            "cat_agentidentifier",
            "cat_environmentid"
        ]);
    } else if (userAuth === 3 && configurationTypeValues.includes(1)) {
        setFieldVisibility(
            formContext,
            ["cat_agentidentifier", "cat_environmentid", "cat_clientid", "cat_tenantid"],
            true,
            "required"
        );
        clearAndHideFields(formContext, [
            "cat_scope",
            "cat_userauthsecretlocationcode",
            "cat_clientsecret",
            "cat_userauthenvironmentvariable"
        ]);
    }

    const directLineSection = formContext.ui.tabs.get("tab_general").sections.get("tab_general_section_directlinesettings");
    if (userAuth === 3 && configurationTypeValues.includes(1)) {
        if (directLineSection) {
            directLineSection.setVisible(false);
            clearAndHideFields(formContext, [
                "cat_directlinechannelsecretlocationcode",
                "cat_directlinechannelsecuritysecret",
                "cat_directlinechannelsecurityenvironmentvariable",
                "cat_tokenendpoint",
                ...(formContext.getAttribute("cat_isdirectlinechannelsecurityenabled")?.getValue() !== null ? ["cat_isdirectlinechannelsecurityenabled"] : [])
            ]);
        }
    }
    else if ((userAuth === 1 && configurationTypeValues.includes(1)) || (userAuth === 2 && configurationTypeValues.includes(1)) || configurationTypeValues.includes(1)) {
        if (directLineSection) {
            directLineSection.setVisible(true);
            setFieldVisibility(formContext, ["cat_isdirectlinechannelsecurityenabled", "cat_tokenendpoint"], true, "required");
            const dlSecurityAttribute = formContext.getAttribute("cat_isdirectlinechannelsecurityenabled");
            // Ensure the Direct Line Channel Security Attribute is set to false if it is null
            if (dlSecurityAttribute && dlSecurityAttribute.getValue() === null) {
                dlSecurityAttribute.setValue(false);
            }
        }
    }

    // User Authentication Secret Location Rule
    const uasecretLocation = formContext
        .getAttribute("cat_userauthsecretlocationcode")
        .getValue();
    if (uasecretLocation === 1 && configurationTypeValues.includes(1)) {
        // Show and require client secret
        setFieldVisibility(
            formContext,
            ["cat_clientsecret"],
            true,
            "required"
        );
        clearAndHideFields(formContext, ["cat_userauthenvironmentvariable"]);
    } else if (uasecretLocation === 2 && configurationTypeValues.includes(1)) {
        // Show and require user auth environment variable
        setFieldVisibility(
            formContext,
            ["cat_userauthenvironmentvariable"],
            true,
            "required"
        );
        clearAndHideFields(formContext, ["cat_clientsecret"]);
    } else {
        // Hide both fields if no valid selection
        clearAndHideFields(formContext, [
            "cat_clientsecret",
            "cat_userauthenvironmentvariable",
        ]);
    }

    const resultsEnrichmentControls = {
        applicationId: "cat_azureappinsightsapplicationid1",
        tenantId: "cat_azureappinsightstenantid1",
        clientId: "cat_azureappinsightsclientid1",
        secretLocationCode: "cat_azureappinsightssecretlocationcode1",
        secret: "cat_azureappinsightssecret1",
        environmentVariable: "cat_azureappinsightsenvironmentvariable1"
    };

    // Control names in Agent Insights section (numbered suffix)
    const agentInsightsControls = {
        agents: "cat_agentname",
        copilotid: "cat_copilotid2",
        dataverseUrl: "cat_dataverseurl2",
        applicationId: "cat_azureappinsightsapplicationid",
        tenantId: "cat_azureappinsightstenantid",
        clientId: "cat_azureappinsightsclientid",
        secretLocationCode: "cat_azureappinsightssecretlocationcode",
        secret: "cat_azureappinsightssecret",
        environmentVariable: "cat_azureappinsightsenvironmentvariable",
        kpiSourceCodes: "cat_kpisourcecodes",
        CaptureUserDetails: "cat_iscaptureuserdetailsenabled",
        CaptureUserFeedback: "cat_iscaptureuserfeedbackenabled"
    };

    const enrichWithAI = formContext
        .getAttribute("cat_isazureapplicationinsightsenabled")
        .getValue();
    const secretLocation = formContext
        .getAttribute("cat_azureappinsightssecretlocationcode")
        .getValue();

    function setControlVisibility(controlName, visible) {
        const control = formContext.getControl(controlName);
        if (control) control.setVisible(visible);
    }

    // Results Enrichment Section - Azure App Insights fields (for Test Automation - 1)
    if (configurationTypeValues.includes(1)) {
        if (enrichWithAI === true) {
            // Show main fields in Results Enrichment section
            setControlVisibility(resultsEnrichmentControls.applicationId, true);
            setControlVisibility(resultsEnrichmentControls.tenantId, true);
            setControlVisibility(resultsEnrichmentControls.clientId, true);
            setControlVisibility(resultsEnrichmentControls.secretLocationCode, true);

            // Handle secret/env variable based on secret location
            if (secretLocation === 1) {
                setControlVisibility(resultsEnrichmentControls.secret, true);
                setControlVisibility(resultsEnrichmentControls.environmentVariable, false);
            } else if (secretLocation === 2) {
                setControlVisibility(resultsEnrichmentControls.secret, false);
                setControlVisibility(resultsEnrichmentControls.environmentVariable, true);
            } else {
                setControlVisibility(resultsEnrichmentControls.secret, false);
                setControlVisibility(resultsEnrichmentControls.environmentVariable, false);
            }
        } else {
            // Hide all Azure App Insights fields in Results Enrichment section
            setControlVisibility(resultsEnrichmentControls.applicationId, false);
            setControlVisibility(resultsEnrichmentControls.tenantId, false);
            setControlVisibility(resultsEnrichmentControls.clientId, false);
            setControlVisibility(resultsEnrichmentControls.secretLocationCode, false);
            setControlVisibility(resultsEnrichmentControls.secret, false);
            setControlVisibility(resultsEnrichmentControls.environmentVariable, false);
        }
    }

    // Agent Insights Section - Azure App Insights fields (for Agent Insights - 4)
    if (configurationTypeValues.includes(4)) {
        // Show all Agent Insights fields
        setControlVisibility(agentInsightsControls.agents, true);
        setControlVisibility(agentInsightsControls.dataverseUrl, true);
        setControlVisibility(agentInsightsControls.applicationId, true);
        setControlVisibility(agentInsightsControls.tenantId, true);
        setControlVisibility(agentInsightsControls.clientId, true);
        setControlVisibility(agentInsightsControls.secretLocationCode, true);
        setControlVisibility(agentInsightsControls.kpiSourceCodes, true);
        setControlVisibility(agentInsightsControls.CaptureUserDetails, true);
        setControlVisibility(agentInsightsControls.CaptureUserFeedback, true);

        // Handle secret/env variable based on secret location
        if (secretLocation === 1) {
            setControlVisibility(agentInsightsControls.secret, true);
            setControlVisibility(agentInsightsControls.environmentVariable, false);
        } else if (secretLocation === 2) {
            setControlVisibility(agentInsightsControls.secret, false);
            setControlVisibility(agentInsightsControls.environmentVariable, true);
        } else {
            setControlVisibility(agentInsightsControls.secret, false);
            setControlVisibility(agentInsightsControls.environmentVariable, false);
        }


    }
    // Set Required Levels based on Enrich with AI and Configuration Types
    if ((enrichWithAI === true && configurationTypeValues.includes(1)) || configurationTypeValues.includes(4)) {
        // At least one section needs the fields - set required levels accordingly
        formContext.getAttribute("cat_azureappinsightsapplicationid")?.setRequiredLevel("required");
        formContext.getAttribute("cat_azureappinsightstenantid")?.setRequiredLevel("required");
        formContext.getAttribute("cat_azureappinsightsclientid")?.setRequiredLevel("required");
        formContext.getAttribute("cat_azureappinsightssecretlocationcode")?.setRequiredLevel("required");

        if (secretLocation === 1) {
            formContext.getAttribute("cat_azureappinsightssecret")?.setRequiredLevel("required");
            formContext.getAttribute("cat_azureappinsightsenvironmentvariable")?.setRequiredLevel("none");
            formContext.getAttribute("cat_azureappinsightsenvironmentvariable")?.setValue(null);
        } else if (secretLocation === 2) {
            formContext.getAttribute("cat_azureappinsightsenvironmentvariable")?.setRequiredLevel("required");
            formContext.getAttribute("cat_azureappinsightssecret")?.setRequiredLevel("none");
            formContext.getAttribute("cat_azureappinsightssecret")?.setValue(null);
        } else {
            formContext.getAttribute("cat_azureappinsightssecret")?.setRequiredLevel("none");
            formContext.getAttribute("cat_azureappinsightsenvironmentvariable")?.setRequiredLevel("none");
        }

        if (configurationTypeValues.includes(4)) {
            formContext.getAttribute("cat_agentname")?.setRequiredLevel("required");
        }
    } else if (!configurationTypeValues.includes(4) && (enrichWithAI === false || enrichWithAI === null)) {
        // Neither section needs AI fields - clear only AI/Agent Insights-specific fields
        formContext.getAttribute("cat_azureappinsightsapplicationid")?.setRequiredLevel("none");
        formContext.getAttribute("cat_azureappinsightstenantid")?.setRequiredLevel("none");
        formContext.getAttribute("cat_azureappinsightsclientid")?.setRequiredLevel("none");
        formContext.getAttribute("cat_azureappinsightssecretlocationcode")?.setRequiredLevel("none");
        formContext.getAttribute("cat_azureappinsightssecret")?.setRequiredLevel("none");
        formContext.getAttribute("cat_azureappinsightsenvironmentvariable")?.setRequiredLevel("none");
        formContext.getAttribute("cat_kpisourcecodes")?.setRequiredLevel("none");
        formContext.getAttribute("cat_agentname")?.setRequiredLevel("none");
        formContext.getAttribute("cat_iscaptureuserdetailsenabled")?.setRequiredLevel("none");
        formContext.getAttribute("cat_iscaptureuserfeedbackenabled")?.setRequiredLevel("none");

        formContext.getAttribute("cat_azureappinsightsapplicationid")?.setValue(null);
        formContext.getAttribute("cat_azureappinsightstenantid")?.setValue(null);
        formContext.getAttribute("cat_azureappinsightsclientid")?.setValue(null);
        formContext.getAttribute("cat_kpisourcecodes")?.setValue(null);
        formContext.getAttribute("cat_azureappinsightssecretlocationcode")?.setValue(null);
        formContext.getAttribute("cat_azureappinsightssecret")?.setValue(null);
        formContext.getAttribute("cat_azureappinsightsenvironmentvariable")?.setValue(null);
        formContext.getAttribute("cat_agentname")?.setValue(null);
        formContext.getAttribute("cat_iscaptureuserdetailsenabled")?.setValue(null);
        formContext.getAttribute("cat_iscaptureuserfeedbackenabled")?.setValue(null);
    }

    // Direct Line Channel Security Fields Rules
    const dlSecurity = formContext
        .getAttribute("cat_isdirectlinechannelsecurityenabled")
        .getValue();
    if (dlSecurity === true && configurationTypeValues.includes(1)) {
        setFieldVisibility(
            formContext,
            ["cat_directlinechannelsecretlocationcode"],
            true,
            "required"
        );
        clearAndHideFields(formContext, ["cat_tokenendpoint"]);
    } else if (dlSecurity === false && configurationTypeValues.includes(1)) {
        clearAndHideFields(formContext, [
            "cat_directlinechannelsecretlocationcode",
        ]);
        setFieldVisibility(formContext, ["cat_tokenendpoint"], true, "required");
    }

    // Direct Line Channel Security Secret Location Fields Rules
    const dlSecretLocation = formContext
        .getAttribute("cat_directlinechannelsecretlocationcode")
        .getValue();
    if (dlSecretLocation === 1 && configurationTypeValues.includes(1)) {
        setFieldVisibility(
            formContext,
            ["cat_directlinechannelsecuritysecret"],
            true,
            "required"
        );
        clearAndHideFields(formContext, [
            "cat_directlinechannelsecurityenvironmentvariable",
        ]);
    } else if (dlSecretLocation === 2 && configurationTypeValues.includes(1)) {
        setFieldVisibility(
            formContext,
            ["cat_directlinechannelsecurityenvironmentvariable"],
            true,
            "required"
        );
        clearAndHideFields(formContext, ["cat_directlinechannelsecuritysecret"]);
    } else {
        clearAndHideFields(formContext, [
            "cat_directlinechannelsecuritysecret",
            "cat_directlinechannelsecurityenvironmentvariable",
        ]);
    }

    // Analyze Generated Answers Fields Rules
    const analyzeAnswers = formContext
        .getAttribute("cat_isgeneratedanswersanalysisenabled")
        .getValue();
    if (analyzeAnswers === true && configurationTypeValues.includes(1)) {
        setFieldVisibility(
            formContext,
            ["cat_generativeaiprovidercode"],
            true,
            "required"
        );
    } else {
        clearAndHideFields(formContext, ["cat_generativeaiprovidercode"]);
    }

    // Enrich with Conversation Transcript Field Rules
    const section = formContext.ui.tabs
        .get("tab_general")
        .sections.get("tab_general_section_conversationtranscriptsenrichment");
    const isEnrichedWithTranscripts = formContext
        .getAttribute("cat_isenrichedwithconversationtranscripts")
        .getValue();

    if (section) {
        const dataverseUrlControl = section.controls.get("cat_dataverseurl3");
        const copyFullTranscriptControl = section.controls.get("cat_iscopyfulltranscriptenabled1");
        const copilotIdControl = section.controls.get("cat_copilotid3");

        // Only show these controls if Test Automation (1) is selected AND enrichment is enabled
        // Hide them if ONLY Agent Insights (4) is selected (without Test Automation)
        if (
            isEnrichedWithTranscripts === true &&
            configurationTypeValues.includes(1)
        ) {
            if (dataverseUrlControl) dataverseUrlControl.setVisible(true);
            formContext.getAttribute("cat_dataverseurl")?.setRequiredLevel("required");
            if (copyFullTranscriptControl) copyFullTranscriptControl.setVisible(true);
            if (copilotIdControl) copilotIdControl.setVisible(true);
            formContext.getAttribute("cat_copilotid")?.setRequiredLevel("required");
        } else {
            // Hide controls - this includes when only Agent Insights (4) is selected
            if (dataverseUrlControl) dataverseUrlControl.setVisible(false);
            if (copyFullTranscriptControl) copyFullTranscriptControl.setVisible(false);
            if (copilotIdControl) copilotIdControl.setVisible(false);
        }
    }

    // Agent Insights Section - Show dataverseurl control and copilotid
    if (configurationTypeValues.includes(4)) {
        setControlVisibility(agentInsightsControls.dataverseUrl, true);
        formContext.getAttribute("cat_dataverseurl")?.setRequiredLevel("required");
        setControlVisibility(agentInsightsControls.copilotid, true);
        formContext.getAttribute("cat_copilotid")?.setRequiredLevel("required");
    }
}

/**
 * @function setFieldVisibility
 * @description Sets visibility and requirement level for fields.
 * @param {object} formContext - The form context.
 * @param {string[]} fieldNames - The field names.
 * @param {boolean} visible - Whether to show the fields.
 * @param {string} requiredLevel - The required level ("required" or "none").
 */
function setFieldVisibility(formContext, fieldNames, visible, requiredLevel) {
    "use strict";
    fieldNames.forEach((fieldName) => {
        const control = formContext.getControl(fieldName);
        if (control) control.setVisible(visible);
        const attribute = formContext.getAttribute(fieldName);
        if (attribute) attribute.setRequiredLevel(requiredLevel);
    });
}

/**
 * @function clearAndHideFields
 * @description Clears and hides fields.
 * @param {object} formContext - The form context.
 * @param {string[]} fieldNames - The field names.
 */
function clearAndHideFields(formContext, fieldNames) {
    "use strict";
    fieldNames.forEach((fieldName) => {
        const attribute = formContext.getAttribute(fieldName);
        if (attribute) attribute.setValue(null);
        const control = formContext.getControl(fieldName);
        if (control) control.setVisible(false);
        if (attribute) attribute.setRequiredLevel("none");
    });
}

/**
 * @function toggleSectionVisibility
 * @description Shows or hides a list of sections within a tab.
 * @param {object} tab - The tab containing the sections.
 * @param {string[]} sectionNames - List of section names to show or hide.
 * @param {boolean} visible - Whether to show or hide the sections.
 */
function toggleSectionVisibility(tab, sectionNames, visible) {
    "use strict";
    sectionNames.forEach((sectionName) => {
        const section = tab.sections.get(sectionName);
        if (section) {
            section.setVisible(visible);
        }
    });
}

/**
 * @function generateConversationKPI
 * @description Generate Conversation KPI for selected duration
 * @param {object} formContext - The form context.
 * @param {string} selectedEntityTypeName - The entity name.
 */
function generateConversationKPI(formContext, selectedEntityTypeName) {
    "use strict";
    const pageInput = {
        pageType: "custom",
        name: "cat_conversationkpi_6082b",
        entityName: selectedEntityTypeName,
        recordId: formContext.data.entity.getId(),
    };
    const navigationOptions = {
        target: 2,
        position: 1,
        height: 330,
        width: 540,
        title: "Generate Conversation KPI",
    };
    Xrm.Navigation.navigateTo(pageInput, navigationOptions).catch(function (
        error
    ) {
        formContext.ui.setFormNotification(
            "Error generating Conversation KPI: " + error.message,
            "ERROR",
            "COOVERSAIONKPIERROR"
        );
        setTimeout(function () {
            formContext.ui.clearFormNotification("COOVERSAIONKPIERROR");
        }, 8000);
    });
}

/**
 * @function showSyncFilesDialog function to display dialog for file sync process, calls the custom action for sync process.
 * @formContext Get the formContext.
 */
function showSyncFilesDialog(formContext) {
    var confirmStrings = {
        text: "This action processes all the file indexer configurations for this agent, and synchronizes files from SharePoint to Copilot Studio as knowledge sources. Please note that at the end of the synchronization process, the agent in question will be published to take new knowledge sources in use.Are you sure you want to proceed with the file synchronization process?",
        title: "Confirm File Synchronization",
    };
    let copilotConfigurationId = formContext.data.entity.getId();
    var confirmOptions = { height: 280, width: 450 };
    let actionExecutionRequest = createExecutionRequest(
        "cat_RunSyncFiles",
        copilotConfigurationId
    );
    let successMessage = "Files sync is in progress.";
    Xrm.Navigation.openConfirmDialog(confirmStrings, confirmOptions).then(
        function (success) {
            if (success.confirmed)
                //execute action
                Xrm.WebApi.online
                    .execute(actionExecutionRequest)
                    .then(
                        function success(result) {
                            if (result.ok) {
                                displayNotification(
                                    formContext,
                                    successMessage,
                                    "INFO",
                                    "FILESYNC_SUCCESS_NOTIFICATION"
                                );
                                removeNotification(
                                    formContext,
                                    "FILESYNC_SUCCESS_NOTIFICATION"
                                );
                            } else {
                                displayNotification(
                                    formContext,
                                    "An error occurred while executing the action. Please try again.",
                                    "ERROR",
                                    "FILESYNC_ERROR_NOTIFICATION"
                                );
                                removeNotification(formContext, "FILESYNC_ERROR_NOTIFICATION");
                            }
                        },
                        function (error) {
                            displayNotification(
                                formContext,
                                `An error occurred while submitting record for file sync execution. Please try again. Error Message: ${error.message}`,
                                "ERROR",
                                "FILESYNC_ERROR_NOTIFICATION"
                            );
                            removeNotification(formContext, "FILESYNC_ERROR_NOTIFICATION");
                        }
                    )
                    .catch(function (error) {
                        displayNotification(
                            formContext,
                            `An error occurred while executing the action. Please try again. Error Message: ${error.message}`,
                            "ERROR",
                            "FILESYNC_ERROR_NOTIFICATION"
                        );
                        removeNotification(formContext, "FILESYNC_ERROR_NOTIFICATION");
                    });
        }
    );
}

/**
 * @function createExecutionRequest create an execution request with all required parameters.
 * @operationName operation name.
 * @copilotConfigurationId Copilot Configuration Id
 * @returns execution request.
 */
function createExecutionRequest(operationName, copilotConfigurationId) {
    "use strict";
    const executionRequest = {
        CopilotConfigurationId: copilotConfigurationId,
        getMetadata: function () {
            return {
                boundParameter: null,
                operationType: 0,
                operationName: operationName,
                parameterTypes: {
                    CopilotConfigurationId: {
                        typeName: "Edm.String",
                        structuralProperty: 1,
                    },
                },
            };
        },
    };
    return executionRequest;
}

/**
 * @function displayNotification display notification on form.
 * @formContext form context.
 * @message notification message.
 * @level notification type.
 * @uniqueId unique id for notification.
 */
function displayNotification(formContext, message, type, uniqueId) {
    "use strict";
    formContext.ui.setFormNotification(message, type, uniqueId);
}

/**
 * @function removeNotification remove notification from form after fixed seconds.
 * @formContext form context.
 * @uniqueId unique id for notification.
 */
function removeNotification(formContext, uniqueId) {
    "use strict";
    setTimeout(function () {
        formContext.ui.clearFormNotification(uniqueId);
    }, 7000);
}

/**
 * @function sharepointValidation
 * @description This function opens a custom page to validate SharePoint connection and display file and page counts.
 * @param {object} formContext - The form context.
 * @param {string} selectedEntityTypeName - The entity name.
 */
function sharepointValidation(formContext, selectedEntityTypeName) {
    "use strict";
    const pageInput = {
        pageType: "custom",
        name: "cat_validatesharepointconnection_d362d",
        entityName: selectedEntityTypeName,
        recordId: formContext.data.entity.getId(),
    };
    const navigationOptions = {
        target: 2,
        position: 1,
        height: 280,
        width: 400,
        title: "Sharepoint Validation",
    };
    Xrm.Navigation.navigateTo(pageInput, navigationOptions).catch(function (
        error
    ) {
        // Display error notification if navigation fails
        formContext.ui.setFormNotification(
            "Error generating Sharepoint Validation: " + error.message,
            "ERROR",
            "SHAREPOINT_VALIDATION_ERROR"
        );
        setTimeout(function () {
            formContext.ui.clearFormNotification("SHAREPOINT_VALIDATION_ERROR");
        }, 8000);
    });
}

/**
 * @function validateTrackedVariablesOnChange
 * @description Triggered when "cat_trackedvariables" field changes.
 *              Allows only blank or non-empty JSON array of non-empty string.
 * @param {object} executionContext - The execution context from the form.
 */
function validateTrackedVariablesOnChange(executionContext) {
    const formContext = executionContext.getFormContext();
    const trackedVariablesAttr = formContext.getAttribute("cat_trackedvariables");
    const trackedVariablesControl = formContext.getControl("cat_trackedvariables");

    if (!trackedVariablesAttr || !trackedVariablesControl) return;
    const rawValue = trackedVariablesAttr.getValue();
    const trimmedValue = rawValue ? rawValue.trim() : "";
    let isValid = false;
    if (!trimmedValue) {
        isValid = true;
    } else {
        try {
            const parsedValue = JSON.parse(trimmedValue);
            isValid = Array.isArray(parsedValue) &&
                parsedValue.length > 0 &&
                parsedValue.every(
                    item => typeof item === "string" && item.trim().length > 0
                );
        } catch (e) {
            isValid = false;
        }
    }
    if (!isValid) {
        trackedVariablesControl.setNotification(
            "Value must be blank or a non-empty JSON array of non-empty strings (e.g., [\"var1\", \"var2\"]).",
            "INVALID_TRACKED_VARIABLES"
        );
    } else {
        trackedVariablesControl.clearNotification("INVALID_TRACKED_VARIABLES");
    }
}