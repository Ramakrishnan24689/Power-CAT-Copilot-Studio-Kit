using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FakeXrmEasy;
using Microsoft.Xrm.Sdk;
using Microsoft.Crm.Sdk.Messages;
using POWERCAT.Plugins.CopilotTestRun;
using System.Collections.Generic;

namespace POWERCAT.UnitTests.CopilotTestRun
{
    [TestClass]
    public class CalculateRollupFieldPluginTests
    {
        [TestMethod]
        public void CalculateRollupFieldPlugin_Should_UpdateRollupFieldSuccessfully()
        {
            // Arrange
            var context = new XrmFakedContext();
            var targetEntity = "cat_copilottestrun";
            var targetId = Guid.NewGuid();
            var fieldName = "cat_success";

            var inputParameters = new ParameterCollection
            {
                { "cat_TargetFieldName", fieldName },
                { "cat_TargetEntityName", targetEntity },
                { "cat_TargetEntityId", targetId.ToString() }
            };

            var pluginContext = context.GetDefaultPluginContext();
            pluginContext.InputParameters = inputParameters;
            pluginContext.OutputParameters = new ParameterCollection();
            pluginContext.UserId = Guid.NewGuid(); // Simulate a user

            // Mock the CalculateRollupFieldRequest
            context.AddExecutionMock<CalculateRollupFieldRequest>(request =>
            {
                var results = new ParameterCollection
                {
                    { "RollupFieldResult", "Rollup field updated successfully." }
                };
                return new CalculateRollupFieldResponse
                {
                    ResponseName = "CalculateRollupField",
                    Results = results
                };
            });

            var plugin = new CalculateRollupFieldPlugin();

            // Act
            context.ExecutePluginWith<CalculateRollupFieldPlugin>(pluginContext);

            // Assert
            Assert.IsTrue(pluginContext.OutputParameters.Contains("cat_Response"));
            Assert.AreEqual("Rollup field updated successfully.", pluginContext.OutputParameters["cat_Response"]);
        }

        [TestMethod]
        public void CalculateRollupFieldPlugin_Should_ThrowException_OnFailure()
        {
            // Arrange
            var context = new XrmFakedContext();
            var targetEntity = "cat_copilottestrun";
            var targetId = Guid.NewGuid();
            var fieldName = "cat_success";

            var inputParameters = new ParameterCollection
            {
                { "cat_TargetFieldName", fieldName },
                { "cat_TargetEntityName", targetEntity },
                { "cat_TargetEntityId", targetId.ToString() }
            };

            var pluginContext = context.GetDefaultPluginContext();
            pluginContext.InputParameters = inputParameters;
            pluginContext.OutputParameters = new ParameterCollection();
            pluginContext.UserId = Guid.NewGuid(); // Simulate a user

            // Mock the CalculateRollupFieldRequest to throw an exception
            context.AddExecutionMock<CalculateRollupFieldRequest>(request =>
            {
                throw new InvalidPluginExecutionException("Test exception");
            });

            var plugin = new CalculateRollupFieldPlugin();

            // Act & Assert
            try
            {
                context.ExecutePluginWith<CalculateRollupFieldPlugin>(pluginContext);
                Assert.Fail("Expected exception was not thrown.");
            }
            catch (InvalidPluginExecutionException ex)
            {
                // Assert
                Assert.AreEqual("Test exception", ex.Message);
            }
        }
    }
}
