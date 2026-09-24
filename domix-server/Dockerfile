# --- שלב ה-Build ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# העתקת קובץ הפרויקט וביצוע שחזור חבילות
COPY domix-server.csproj .
RUN dotnet restore "domix-server.csproj"

# העתקת כל שאר הקוד וביצוע Publish
COPY . .
RUN dotnet publish -c Release -o /app/publish

# --- שלב ה-Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "domix-server.dll"]