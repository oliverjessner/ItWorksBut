export function createArtilleryConfig({ target, duration, arrivalRate, maxVusers, endpoints }) {
  const flow = endpoints.map((endpoint) => ({
    [endpoint.method.toLowerCase()]: {
      url: endpoint.path
    }
  }));

  return {
    config: {
      target,
      phases: [
        {
          duration,
          arrivalRate,
          maxVusers
        }
      ],
      defaults: {
        headers: {
          "user-agent": "ItWorksBut Stress"
        }
      }
    },
    scenarios: [
      {
        name: "Discovered API endpoints",
        flow
      }
    ]
  };
}
