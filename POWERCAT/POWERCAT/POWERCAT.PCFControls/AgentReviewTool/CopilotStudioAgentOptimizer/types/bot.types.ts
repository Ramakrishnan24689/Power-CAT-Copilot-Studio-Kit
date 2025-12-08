/**
 * Bot Entity Type Definitions
 * Types for Dataverse Bot entity and related structures
 */

/**
 * OData response wrapper for bot queries
 */
export interface SampleBotDetails {
    '@odata.context': string;
    value: BotDetail[];
}

/**
 * Complete bot entity from Dataverse bot table
 * Includes all Dataverse metadata fields
 */
export interface BotDetail {
    '@odata.etag': string;
    overriddencreatedon: null | string;
    modifiedon: string;
    supportedlanguages: null | string;
    solutionid: string;
    importsequencenumber: null | number;
    _owningteam_value: null | string;
    ismanaged: boolean;
    _ownerid_value: string;
    _modifiedby_value: string;
    applicationmanifestinformation: null | string;
    authenticationtrigger: number;
    _publishedby_value: null | string;
    componentstate: number;
    utcconversiontimezonecode: null | number;
    iconbase64: string | null;
    configuration: string; // JSON string - parse as BotConfiguration
    language: number;
    publishedon: string;
    synchronizationstatus: string; // JSON string - parse as BotSynchronizationStatus
    statecode: number;
    botid: string;
    overwritetime: string;
    _createdonbehalfby_value: null | string;
    _modifiedonbehalfby_value: null | string;
    versionnumber: number;
    origin: null | string;
    _owningbusinessunit_value: string;
    authenticationconfiguration: null | string;
    statuscode: number;
    schemaname: string;
    authenticationmode: number;
    createdon: string;
    timezoneruleversionnumber: number;
    name: string;
    runtimeprovider: number;
    _providerconnectionreferenceid_value: null | string;
    accesscontrolpolicy: number;
    template: string;
    _createdby_value: string;
    authorizedsecuritygroupids: null | string;
    componentidunique: string;
    _owninguser_value: string;
    iscustomizable: IsCustomizable;
}

/**
 * Managed property indicating if the bot can be customized
 */
export interface IsCustomizable {
    Value: boolean;
    CanBeChanged: boolean;
    ManagedPropertyLogicalName: string;
}

/**
 * Bot configuration settings (parsed from BotDetail.configuration JSON string)
 * Full version with all nested settings
 */
export interface BotConfiguration {
    $kind: string;
    settings: {
        GenerativeActionsEnabled: boolean;
    };
    gPTSettings: {
        $kind: string;
        defaultSchemaName: string;
    };
    aISettings: {
        $kind: string;
        useModelKnowledge: boolean;
        isSemanticSearchEnabled: boolean;
        optInUseLatestModels: boolean;
    };
    recognizer: {
        $kind: string;
    };
}

/**
 * Bot synchronization status (parsed from BotDetail.synchronizationstatus JSON string)
 */
export interface BotSynchronizationStatus {
    $kind: string;
    contentVersion: number;
    lastFinishedPublishOperation: {
        $kind: string;
        operationStart: string;
        operationEnd: string;
        status: string;
    };
    lastPublishedDetails: {
        $kind: string;
        authenticationMode: string;
    };
    currentSynchronizationState: {
        $kind: string;
        botRegistration: {
            $kind: string;
            botRegistrationIdConsumptionTime: string;
            applicationId: string;
            isAppAvailableInTenant: boolean;
        };
        provisioningStatus: string;
    };
}
