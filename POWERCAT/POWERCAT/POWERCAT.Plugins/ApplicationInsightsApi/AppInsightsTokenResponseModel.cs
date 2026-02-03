// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

namespace POWERCAT.Plugins.ApplicationInsightsApi
{
    /// <summary>
    /// Represents the response from Azure AD token endpoint for Application Insights.
    /// </summary>
    internal class AppInsightsTokenResponse
    {
        public string token_type { get; set; }
        public string expires_in { get; set; }
        public string ext_expires_in { get; set; }
        public string expires_on { get; set; }
        public string not_before { get; set; }
        public string resource { get; set; }
        public string access_token { get; set; }
    }
}