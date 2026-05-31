import emailjs from '@emailjs/browser';

const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';

// Initialize emailjs if public key is provided
if (publicKey && publicKey !== 'your_public_key_here') {
  emailjs.init(publicKey);
}

export const sendShipmentEmail = async (shipment: any) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping shipment email.');
  
  const toEmail = shipment.receiver_email || shipment.to?.email || shipment.userEmail;
  const trackingNumber = shipment.trackingNumber || shipment.tracking_code || "Unknown";
  const senderName = shipment.from?.name || shipment.sender_name || "SWIFTLY LOGIX Logistics";
  
  if (!toEmail) return;

  const extraDetailsHtml = `
    <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Service:</strong> ${shipment.service || "Standard Delivery"}</p>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Origin:</strong> ${senderName}</p>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4B5563;"><strong>Destination:</strong> ${shipment.to?.name || shipment.receiver_name || "Recipient"}</p>
      <p style="margin: 0; font-size: 14px; color: #4B5563;"><strong>Expected Delivery:</strong> ${shipment.estimatedDelivery || shipment.expected_delivery_date || "TBD"}</p>
    </div>
  `;

  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      to_name: shipment.to?.name || shipment.receiver_name || "Customer",
      notification_type: "SHIPMENT UPDATE",
      main_title: "A new shipment is on its way to you",
      message_body: `${senderName} has just created a shipment for you. You can track the progress of your package by clicking the button below.`,
      extra_details_html: extraDetailsHtml,
      action_text: "Track Package",
      action_url: `https://swiftlylogix.com/tracking?tn=${trackingNumber}`
    });
    console.log('Shipment email sent successfully');
  } catch (error) {
    console.error('Failed to send shipment email:', error);
  }
};

export const sendBillEmail = async (toEmail: string, title: string, amount: number, note: string) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping bill email.');
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "BILLING INVOICE",
      main_title: `Invoice: ${title}`,
      message_body: `A new bill of $${amount.toFixed(2)} has been generated for your account. Notes: ${note}. Please review and settle this invoice at your earliest convenience.`,
      extra_details_html: "",
      action_text: "View Billing",
      action_url: `https://swiftlylogix.com/billing`
    });
    console.log('Bill email sent successfully');
  } catch (error) {
    console.error('Failed to send bill email:', error);
  }
};

export const sendBillPaidEmail = async (toEmail: string, title: string, amount: number) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping bill paid email.');
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "PAYMENT CONFIRMATION",
      main_title: "Payment Received Successfully",
      message_body: `Your payment of $${amount.toFixed(2)} for the invoice "${title}" has been received and processed successfully. The shipment attached to this bill is now cleared and ready to be on its way.`,
      extra_details_html: "",
      action_text: "View Dashboard",
      action_url: `https://swiftlylogix.com/dashboard`
    });
    console.log('Bill paid email sent successfully');
  } catch (error) {
    console.error('Failed to send bill paid email:', error);
  }
};

export const sendDepositEmail = async (toEmail: string, amount: number, status: string) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping deposit email.');
  
  const isApproved = status.toLowerCase() === "approved";
  
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "DEPOSIT STATUS",
      main_title: isApproved ? "Deposit Approved" : "Deposit Rejected",
      message_body: isApproved 
        ? `Great news! Your deposit of $${amount.toFixed(2)} has been approved and successfully credited to your account balance.`
        : `Unfortunately, your deposit of $${amount.toFixed(2)} could not be approved at this time. Please contact support if you believe this is an error.`,
      extra_details_html: "",
      action_text: "View Dashboard",
      action_url: `https://swiftlylogix.com/dashboard`
    });
    console.log('Deposit email sent successfully');
  } catch (error) {
    console.error('Failed to send deposit email:', error);
  }
};

export const sendAccountEmail = async (toEmail: string, status: string) => {
  if (!serviceId || serviceId === 'your_service_id_here') return console.warn('EmailJS not configured. Skipping account status email.');
  
  const isApproved = status.toLowerCase() === "approved";
  
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      notification_type: "ACCOUNT STATUS",
      main_title: isApproved ? "Welcome to SWIFTLY LOGIX!" : "Account Update",
      message_body: isApproved
        ? `Your account has been fully approved. You now have full access to the SWIFTLY LOGIX Logistics dashboard and can start tracking and managing your shipments.`
        : `After reviewing your application, we regret to inform you that your account has been declined. Please contact our support team for more details.`,
      extra_details_html: "",
      action_text: isApproved ? "Login Now" : "Contact Support",
      action_url: isApproved ? `https://swiftlylogix.com/auth/login` : `https://swiftlylogix.com/support/help-center`
    });
    console.log('Account status email sent successfully');
  } catch (error) {
    console.error('Failed to send account status email:', error);
  }
};
