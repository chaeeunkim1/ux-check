const nextConfig = {
 poweredByHeader: false,
 serverExternalPackages:['puppeteer-core','@sparticuz/chromium'],
 outputFileTracingIncludes:{'/api/capture':['./node_modules/@sparticuz/chromium/bin/**','./assets/fonts/**']}
};
export default nextConfig;
