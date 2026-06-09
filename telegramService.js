import TelegramBot from "node-telegram-bot-api";

let bot = null;
let Student, TelegramLinkToken;

export function initTelegramBot(models) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN not provided. Telegram features will be disabled.");
    return {
      sendMessage: async () => {},
      broadcastMessage: async () => ({ sent: 0, failed: 0 })
    };
  }

  // Initialize bot with polling
  bot = new TelegramBot(token, { polling: true });
  Student = models.Student;
  TelegramLinkToken = models.TelegramLinkToken;

  console.log("✓ Telegram Bot initialized");

  // Handle /start with link token
  bot.onText(/\/start (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const tokenStr = match[1];

    try {
      const linkRecord = await TelegramLinkToken.findOne({ token: tokenStr });
      
      if (!linkRecord) {
        bot.sendMessage(chatId, "❌ Invalid or expired linking token. Please try again from the portal.");
        return;
      }

      if (linkRecord.expiresAt < new Date()) {
        bot.sendMessage(chatId, "❌ This linking token has expired. Please generate a new one from the portal.");
        await TelegramLinkToken.deleteOne({ _id: linkRecord._id });
        return;
      }

      const updateData = {};
      if (linkRecord.type === "student") {
        updateData.telegramStudentChatId = chatId.toString();
        updateData.telegramStudentConnectedAt = new Date();
      } else {
        updateData.telegramParentChatId = chatId.toString();
        updateData.telegramParentConnectedAt = new Date();
      }

      await Student.findOneAndUpdate({ id: linkRecord.studentId }, { $set: updateData });
      
      // Delete used token
      await TelegramLinkToken.deleteOne({ _id: linkRecord._id });

      bot.sendMessage(chatId, `✅ Successfully connected to Kishan Classes as a ${linkRecord.type}!\n\nYou will now receive important updates here.\nTry sending /help to see available commands.`);

    } catch (error) {
      console.error("Error linking telegram account:", error);
      bot.sendMessage(chatId, "❌ An error occurred while linking your account. Please try again.");
    }
  });

  // Handle bare /start
  bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "🏫 Welcome to the Kishan Classes Bot!\n\nTo connect your account, please click the 'Connect Telegram' button in your student portal.");
  });

  // Handle /help
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
*🏫 Kishan Classes Bot Commands:*

/profile - View your profile info
/fees - Check current fee status
/results - View latest test results
/attendance - View attendance (Coming soon)
/help - Show this message
    `;
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  });

  // Helper to get student by chat id
  async function getStudentByChatId(chatId) {
    const strId = chatId.toString();
    const student = await Student.findOne({
      $or: [
        { telegramStudentChatId: strId },
        { telegramParentChatId: strId }
      ]
    }).lean();
    
    if (student && (student.status === "Dropped" || student.status === "Inactive")) {
      return { _blocked: true };
    }
    
    return student;
  }

  // Handle /profile
  bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const student = await getStudentByChatId(chatId);
    if (!student) {
      return bot.sendMessage(chatId, "❌ Your account is not linked. Please link from the portal.");
    }
    if (student._blocked) {
      return bot.sendMessage(chatId, "❌ Your access has been disabled because your account is no longer active.");
    }

    let batchName = 'N/A';
    if (student.batchId) {
      const batch = await models.Batch.findOne({ id: student.batchId }).lean();
      if (batch) batchName = batch.name;
    }
    
    const profileText = `
*👤 Student Profile*
Name: ${student.fullName}
Student ID: ${student.studentId}
Class: ${student.classGrade}
Batch: ${batchName}
Phone: ${student.contactNumber}
    `;
    bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
  });

  // Handle /fees
  bot.onText(/\/fees/, async (msg) => {
    const chatId = msg.chat.id;
    const student = await getStudentByChatId(chatId);
    if (!student) {
      return bot.sendMessage(chatId, "❌ Your account is not linked.");
    }
    if (student._blocked) {
      return bot.sendMessage(chatId, "❌ Your access has been disabled because your account is no longer active.");
    }

    const FeeRecord = models.FeeRecord;
    const allFees = await FeeRecord.find({ studentId: student.id }).lean();
    
    // Import locally to avoid Render deployment issues with the parent directory
    const { getCompletedFeeTenures } = await import("./feeVisibility.js");

    const filteredFees = getCompletedFeeTenures(allFees, student);
    
    const recentFees = [...filteredFees]
      .filter(f => f.status !== "Paid")
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
      .slice(0, 5); // Show up to 5 pending records
    
    if (recentFees.length === 0) {
      return bot.sendMessage(chatId, "No pending fee records found.");
    }


    const generatedMonthlyDues = filteredFees.filter(r => r.transactionType !== "OPENING_BALANCE").reduce((sum, r) => sum + (Number(r.amountDue) || 0), 0);
    const previousBalance = filteredFees.filter(r => r.transactionType === "OPENING_BALANCE").reduce((sum, r) => sum + (Number(r.amountDue) || 0), 0);
    const paymentsReceived = filteredFees.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
    const totalRemaining = Math.max(0, previousBalance + generatedMonthlyDues - paymentsReceived);

    let feeText = `*💰 Recent Fee Status*\n\n`;
    recentFees.forEach(f => {
      feeText += `*${f.tenureLabel}*\nDue: ₹${f.amountDue}\nPaid: ₹${f.amountPaid}\nStatus: *${f.computedStatus}*\n---\n`;
    });

    feeText += `\n*Total Remaining Fees:* ₹${totalRemaining}`;

    bot.sendMessage(chatId, feeText, { parse_mode: 'Markdown' });
  });

  // Handle /results
  bot.onText(/\/results/, async (msg) => {
    const chatId = msg.chat.id;
    const student = await getStudentByChatId(chatId);
    if (!student) {
      return bot.sendMessage(chatId, "❌ Your account is not linked.");
    }
    if (student._blocked) {
      return bot.sendMessage(chatId, "❌ Your access has been disabled because your account is no longer active.");
    }

    const Test = models.Test;
    const tests = await Test.find({ studentId: student.id }).sort({ testDate: -1 }).limit(3).lean();
    
    if (tests.length === 0) {
      return bot.sendMessage(chatId, "No test results found.");
    }

    let testText = `*📊 Recent Test Results*\n\n`;
    tests.forEach(t => {
      testText += `Test: ${t.testName}\nSubject: ${t.subject}\nMarks: ${t.marksObtained}/${t.maxMarks}\nGrade: *${t.grade || 'N/A'}*\nDate: ${t.testDate}\n---\n`;
    });

    testText += `\n_For past test scores visit mobile application or web portal_`;

    bot.sendMessage(chatId, testText, { parse_mode: 'Markdown' });
  });

  // Handle /attendance
  bot.onText(/\/attendance/, async (msg) => {
    const chatId = msg.chat.id;
    const student = await getStudentByChatId(chatId);
    if (!student) {
      return bot.sendMessage(chatId, "❌ Your account is not linked.");
    }
    if (student._blocked) {
      return bot.sendMessage(chatId, "❌ Your access has been disabled because your account is no longer active.");
    }
    bot.sendMessage(chatId, "Attendance feature is currently under development.");
  });

  // Service Methods
  return {
    sendMessage: async (chatId, message) => {
      if (!bot || !chatId) return false;
      try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        return true;
      } catch (err) {
        console.error(`Failed to send telegram message to ${chatId}:`, err.message);
        return false;
      }
    },
    
    broadcastMessage: async (chatIds, message) => {
      if (!bot || !chatIds || chatIds.length === 0) return { sent: 0, failed: 0 };
      
      let sent = 0;
      let failed = 0;
      
      // Simple rate limiting (send 30 per second max as per Telegram limits, we do 10 per sec to be safe)
      const chunk = 10;
      for (let i = 0; i < chatIds.length; i += chunk) {
        const batch = chatIds.slice(i, i + chunk);
        const promises = batch.map(async (chatId) => {
          try {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            sent++;
          } catch (err) {
            console.error(`Broadcast failed to ${chatId}:`, err.message);
            failed++;
          }
        });
        await Promise.all(promises);
        if (i + chunk < chatIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return { sent, failed };
    }
  };
}
