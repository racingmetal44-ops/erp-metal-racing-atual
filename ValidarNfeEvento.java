import java.io.File;
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;

public class ValidarNfeEvento {
    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Uso: java ValidarNfeEvento <xsd> <xml>");
            System.exit(2);
        }

        File xsd = new File(args[0]);
        File xml = new File(args[1]);

        SchemaFactory factory =
            SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);

        Schema schema =
            factory.newSchema(xsd);

        Validator validator =
            schema.newValidator();

        validator.validate(new StreamSource(xml));

        System.out.println("VALIDO");
    }
}
