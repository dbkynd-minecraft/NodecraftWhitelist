import Discord, { Client, MessageEmbed } from 'discord.js'
import { SlashCommandBuilder } from '@discordjs/builders'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'
import axios from 'axios'
import Rcon from 'modern-rcon'

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  DISCORD_CHANNEL_ID,
  RCON_HOST,
  RCON_PORT,
  RCON_PASSWORD,
} = process.env

const client = new Client({ intents: [] })
const rcon = new Rcon(RCON_HOST, parseInt(RCON_PORT), RCON_PASSWORD, 3000)

const commands = [
  new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Add your Minecraft username to the server whitelist.')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Your Minecraft in-game name.')
        .setRequired(true),
    ),
].map((command) => command.toJSON())

const rest = new REST({ version: '9' }).setToken(DISCORD_TOKEN)

rest
  .put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
    body: commands,
  })
  .then(() => console.log('Successfully registered application commands.'))
  .catch(console.error)

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return
  const { commandName } = interaction
  if (commandName !== 'whitelist') return
  if (interaction.channelId !== DISCORD_CHANNEL_ID) {
    await interaction.reply({ content: `Please use the <#${DISCORD_CHANNEL_ID}> channel.`, ephemeral: true })
    return
  }
  await interaction.deferReply()
  const name = interaction.options.getString('name', true)

  const user: MojangUser | null = await axios
    .get(`https://api.mojang.com/users/profiles/minecraft/${name}`)
    .then(({ data }) => data)
    .catch(() => null)
  if (!user) {
    await interaction.editReply(
      'There is no Mojang account with that username. Please check your spelling and try again.',
    )
    return
  }

  const thumbnail = `https://crafatar.com/renders/body/${user.id}?overlay=true`
  await axios.get(thumbnail)

  let result: string | null
  try {
    result = await addToWhitelist(user.name)
  } catch (err) {
    await interaction.editReply(
      `There was an error adding ${user.name} to the whitelist. Please try again.`,
    )
    return
  }
  if (!result) {
    await interaction.editReply(
      `Unable to connect to the server. Please try again later.`,
    )
    return
  }

  const embed = new MessageEmbed()
    .setColor(0x5a9a30)
    .setDescription(
      `\`\`\`${user.name}\`\`\`\n${Discord.Util.escapeMarkdown(result)}`,
    )
    .setThumbnail(thumbnail)

  await interaction.editReply({ embeds: [embed] })
})

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  throw err
})

function addToWhitelist(name: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    rcon
      .connect()
      .then(
        () => {
          return rcon.send(`/whitelist add ${name}`)
        },
        () => {
          resolve(null)
        },
      )
      .then((res: string) => {
        resolve(res)
      })
      .then(() => {
        return rcon.disconnect()
      })
      .catch(reject)
  })
}
