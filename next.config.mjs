const nextConfig = {
 poweredByHeader: false,
 serverExternalPackages:['puppeteer-core','@sparticuz/chromium'],
 outputFileTracingIncludes:{'/api/capture':['./node_modules/@sparticuz/chromium/bin/**']}
};
export default nextConfig;
