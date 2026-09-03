# Use the .NET 10 SDK image for building
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["domix-server.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

# Use the .NET 10 runtime image for the final container
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .

# Opt-in only: some local networks (e.g. the NetFree content filter, common on Israeli ISPs/routers)
# intercept outbound HTTPS with their own CA, which the Windows host trusts but this container does
# not — outbound calls (Gemini, Nominatim, data.gov.il, Gmail OAuth...) fail TLS validation as a
# result. Pass --build-arg TRUST_LOCAL_DEV_CA=true (docker-compose.yml does this by default for local
# dev) to trust it in the image; a real deployment must never set this.
ARG TRUST_LOCAL_DEV_CA=false
COPY docker/certs/*.crt /usr/local/share/ca-certificates/netfree-dev/
RUN if [ "$TRUST_LOCAL_DEV_CA" = "true" ]; then \
        update-ca-certificates; \
    else \
        rm -f /usr/local/share/ca-certificates/netfree-dev/*.crt; \
    fi

ENTRYPOINT ["dotnet", "domix-server.dll"]