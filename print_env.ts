console.log("Environment variables:");
for (const key of Object.keys(process.env)) {
  if (key.includes("FIREBASE") || key.includes("GOOGLE") || key.includes("PORT") || key.includes("SERVICE")) {
    console.log(`${key}: ${process.env[key] ? 'PRESENTS' : 'EMPTY'}`);
  }
}
