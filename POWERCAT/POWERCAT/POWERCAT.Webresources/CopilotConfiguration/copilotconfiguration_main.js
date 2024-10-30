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
      ["cat_clientid", "cat_tenantid", "cat_scope"],
      true,
      "required"
    );

    // No Authentication and Test Automation
  } else if (userAuth === 1 && configurationTypeValues.includes(1)) {
    clearAndHideFields(formContext, [
      "cat_clientid",
      "cat_tenantid",
      "cat_scope",
    ]);
  }

  // Enrich With Azure Application Insights Secret Location Rule
  const secretLocation = formContext
    .getAttribute("cat_azureappinsightssecretlocationcode")
    .getValue();
  if (secretLocation === 1 && configurationTypeValues.includes(1)) {
    setFieldVisibility(
      formContext,
      ["cat_azureappinsightssecret"],
      true,
      "required"
    );
    clearAndHideFields(formContext, [
      "cat_azureappinsightsenvironmentvariable",
    ]);
  } else if (secretLocation === 2 && configurationTypeValues.includes(1)) {
    setFieldVisibility(
      formContext,
      ["cat_azureappinsightsenvironmentvariable"],
      true,
      "required"
    );
    clearAndHideFields(formContext, ["cat_azureappinsightssecret"]);
  } else {
    clearAndHideFields(formContext, [
      "cat_azureappinsightssecret",
      "cat_azureappinsightsenvironmentvariable",
    ]);
  }

  // Enrich With Azure Application Insights Fields Rules
  const enrichWithAI = formContext
    .getAttribute("cat_isazureapplicationinsightsenabled")
    .getValue();
  if (enrichWithAI === true && configurationTypeValues.includes(1)) {
    setFieldVisibility(
      formContext,
      [
        "cat_azureappinsightsapplicationid",
        "cat_azureappinsightstenantid",
        "cat_azureappinsightsclientid",
        "cat_azureappinsightssecretlocationcode",
      ],
      true,
      "required"
    );
  } else if (enrichWithAI === false && configurationTypeValues.includes(1)) {
    clearAndHideFields(formContext, [
      "cat_azureappinsightsapplicationid",
      "cat_azureappinsightstenantid",
      "cat_azureappinsightsclientid",
      "cat_azureappinsightssecretlocationcode",
      "cat_azureappinsightssecret",
      "cat_azureappinsightsenvironmentvariable",
    ]);
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

  if (
    isEnrichedWithTranscripts === true &&
    configurationTypeValues.includes(1)
  ) {
    section.controls.get("cat_dataverseurl1").setVisible(true);
    formContext.getAttribute("cat_dataverseurl").setRequiredLevel("required");
    section.controls.get("cat_iscopyfulltranscriptenabled1").setVisible(true);
  } else {
    section.controls.get("cat_dataverseurl1").setVisible(false);
    section.controls.get("cat_iscopyfulltranscriptenabled1").setVisible(false);
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
 * @function showSyncFilesDialog
 * @description Opens a custom page dialog for syncing files with parameters in a Model-Driven App.
 * @param {object} formContext - The form context.
 * @param {string} selectedEntityTypeName - The name of the selected entity.
 */
function showSyncFilesDialog(formContext, selectedEntityTypeName) {
  "use strict";
  const pageInput = {
    pageType: "custom",
    name: "cat_syncfilesprompt_819c3",
    entityName: selectedEntityTypeName,
    recordId: formContext.data.entity.getId(),
  };
  const navigationOptions = {
    target: 2,
    position: 1,
    height: 370,
    width: 540,
    title: " ",
  };
  Xrm.Navigation.navigateTo(pageInput, navigationOptions).catch(function (
    error
  ) {
    formContext.ui.setFormNotification(
      "Error syncing files: " + error.message,
      "ERROR",
      "SYNCFILESERROR"
    );
    setTimeout(function () {
      formContext.ui.clearFormNotification("SYNCFILESERROR");
    }, 8000);
  });
}
