const nextConfig = {
  allowedDevOrigins: ["hmm.ngrok.dev"],
  transpilePackages: [
    "@ledgerai/ui",
    "@ledgerai/config",
    "@ledgerai/audit",
    "@ledgerai/auth",
    "@ledgerai/compliance-gst",
    "@ledgerai/compliance-income-tax",
    "@ledgerai/compliance-na",
    "@ledgerai/ai-extraction",
    "@ledgerai/accounting",
    "@ledgerai/documents"
  ]
};

export default nextConfig;
